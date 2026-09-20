-- Owner-scoped commercial overview for the WiseURL dashboard.
-- This is additive: the detailed analytics functions remain unchanged.

CREATE OR REPLACE FUNCTION public.wiseurl_overview_report(
  p_from date,
  p_to date,
  p_source text DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_traffic text DEFAULT 'non_bot',
  p_as_of timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  range_start timestamptz;
  range_full_end timestamptz;
  range_end timestamptz;
  previous_start timestamptz;
  previous_end timestamptz;
  today_bucharest date;
  normalized_source text;
  normalized_traffic text;
  is_partial boolean;
  result jsonb;
BEGIN
  today_bucharest := (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date;
  normalized_source := NULLIF(btrim(p_source), '');
  normalized_traffic := COALESCE(NULLIF(btrim(p_traffic), ''), 'non_bot');

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid overview date range' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from + 1 > 366 THEN
    RAISE EXCEPTION 'Overview date range cannot exceed 366 days' USING ERRCODE = '22023';
  END IF;
  IF p_from > today_bucharest OR p_to > today_bucharest THEN
    RAISE EXCEPTION 'Overview date range cannot be in the future' USING ERRCODE = '22023';
  END IF;
  IF normalized_traffic NOT IN ('non_bot', 'all', 'bots') THEN
    RAISE EXCEPTION 'Invalid overview traffic mode' USING ERRCODE = '22023';
  END IF;

  range_start := p_from::timestamp AT TIME ZONE 'Europe/Bucharest';
  range_full_end := (p_to + 1)::timestamp AT TIME ZONE 'Europe/Bucharest';
  IF p_as_of IS NOT NULL AND p_as_of < range_start THEN
    RAISE EXCEPTION 'Overview as-of time cannot precede range start' USING ERRCODE = '22023';
  END IF;

  range_end := LEAST(range_full_end, COALESCE(p_as_of, statement_timestamp()), statement_timestamp());
  previous_start := (p_from - (p_to - p_from + 1))::timestamp AT TIME ZONE 'Europe/Bucharest';
  previous_end := LEAST(range_start, previous_start + (range_end - range_start));
  previous_start := previous_end - (range_end - range_start);
  is_partial := range_end < range_full_end;

  WITH owned_links AS (
    SELECT l.id, l.code::text, l.title::text, l.destination_url, l.group_id, l.is_active
    FROM public.links l
    WHERE l.user_id = auth.uid()
      AND (p_group_id IS NULL OR l.group_id = p_group_id)
  ),
  attributed AS (
    SELECT
      c.id,
      c.link_id,
      c.clicked_at,
      c.is_bot,
      public.wiseurl_source_label(c.utm_source, c.source_label, c.source_kind, c.original_referrer) AS resolved_source,
      public.wiseurl_source_kind(c.utm_source, c.source_label, c.source_kind, c.original_referrer) AS resolved_kind
    FROM public.clicks c
    JOIN owned_links l ON l.id = c.link_id
    WHERE c.clicked_at >= previous_start
      AND c.clicked_at < range_end
  ),
  scoped AS (
    SELECT *
    FROM attributed a
    WHERE (normalized_source IS NULL OR a.resolved_source = normalized_source)
      AND CASE normalized_traffic
        WHEN 'non_bot' THEN NOT COALESCE(a.is_bot, false)
        WHEN 'bots' THEN COALESCE(a.is_bot, false)
        ELSE true
      END
  ),
  current_rows AS (
    SELECT * FROM scoped WHERE clicked_at >= range_start AND clicked_at < range_end
  ),
  previous_rows AS (
    SELECT * FROM scoped WHERE clicked_at >= previous_start AND clicked_at < previous_end
  ),
  totals AS (
    SELECT
      count(*)::bigint AS clicks,
      count(DISTINCT link_id)::bigint AS links_with_clicks,
      count(DISTINCT resolved_source) FILTER (WHERE resolved_kind <> 'unknown')::bigint AS source_count,
      count(*) FILTER (WHERE resolved_kind = 'unknown')::bigint AS unknown_clicks
    FROM current_rows
  ),
  previous_totals AS (
    SELECT count(*)::bigint AS clicks FROM previous_rows
  ),
  current_link_stats AS (
    SELECT link_id, count(*)::bigint AS clicks, max(clicked_at) AS latest_click
    FROM current_rows
    GROUP BY link_id
  ),
  previous_link_stats AS (
    SELECT link_id, count(*)::bigint AS previous_clicks
    FROM previous_rows
    GROUP BY link_id
  ),
  current_link_source_ranked AS (
    SELECT
      link_id,
      resolved_source,
      row_number() OVER (PARTITION BY link_id ORDER BY count(*) DESC, resolved_source) AS rank
    FROM current_rows
    GROUP BY link_id, resolved_source
  ),
  link_rows AS (
    SELECT
      l.id,
      l.code,
      l.title,
      l.destination_url,
      l.group_id,
      l.is_active,
      COALESCE(current_stats.clicks, 0)::bigint AS clicks,
      COALESCE(previous_stats.previous_clicks, 0)::bigint AS previous_clicks,
      lead_source.resolved_source AS leading_source,
      current_stats.latest_click
    FROM owned_links l
    LEFT JOIN current_link_stats current_stats ON current_stats.link_id = l.id
    LEFT JOIN previous_link_stats previous_stats ON previous_stats.link_id = l.id
    LEFT JOIN current_link_source_ranked lead_source ON lead_source.link_id = l.id AND lead_source.rank = 1
  ),
  links_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', rows.id,
        'code', rows.code,
        'title', rows.title,
        'destination_url', rows.destination_url,
        'group_id', rows.group_id,
        'is_active', rows.is_active,
        'clicks', rows.clicks,
        'previous_clicks', rows.previous_clicks,
        'leading_source', rows.leading_source,
        'latest_click', rows.latest_click
      ) ORDER BY rows.clicks DESC, rows.previous_clicks DESC, rows.code
    ), '[]'::jsonb) AS value
    FROM link_rows rows
  ),
  source_names AS (
    SELECT resolved_source AS source FROM current_rows
    UNION
    SELECT resolved_source AS source FROM previous_rows
  ),
  comparison_rows AS (
    SELECT * FROM current_rows
    UNION ALL
    SELECT * FROM previous_rows
  ),
  source_provenance AS (
    SELECT
      resolved_source AS source,
      CASE WHEN count(DISTINCT resolved_kind) = 1 THEN min(resolved_kind) ELSE 'mixed' END AS provenance
    FROM comparison_rows
    GROUP BY resolved_source
  ),
  current_source_stats AS (
    SELECT resolved_source AS source, count(*)::bigint AS clicks
    FROM current_rows
    GROUP BY resolved_source
  ),
  previous_source_stats AS (
    SELECT resolved_source AS source, count(*)::bigint AS previous_clicks
    FROM previous_rows
    GROUP BY resolved_source
  ),
  current_source_link_ranked AS (
    SELECT
      c.resolved_source AS source,
      l.code,
      row_number() OVER (PARTITION BY c.resolved_source ORDER BY count(*) DESC, l.code) AS rank
    FROM current_rows c
    JOIN owned_links l ON l.id = c.link_id
    GROUP BY c.resolved_source, l.code
  ),
  source_rows AS (
    SELECT
      names.source,
      provenance.provenance,
      COALESCE(current_stats.clicks, 0)::bigint AS clicks,
      COALESCE(previous_stats.previous_clicks, 0)::bigint AS previous_clicks,
      lead_link.code AS leading_link_code
    FROM source_names names
    JOIN source_provenance provenance ON provenance.source = names.source
    LEFT JOIN current_source_stats current_stats ON current_stats.source = names.source
    LEFT JOIN previous_source_stats previous_stats ON previous_stats.source = names.source
    LEFT JOIN current_source_link_ranked lead_link ON lead_link.source = names.source AND lead_link.rank = 1
  ),
  sources_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'source', rows.source,
        'provenance', rows.provenance,
        'clicks', rows.clicks,
        'previous_clicks', rows.previous_clicks,
        'leading_link_code', rows.leading_link_code
      ) ORDER BY rows.clicks DESC, rows.previous_clicks DESC, rows.source
    ), '[]'::jsonb) AS value
    FROM source_rows rows
  ),
  days AS (
    SELECT day::date AS day
    FROM generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') day
  ),
  daily_stats AS (
    SELECT
      (clicked_at AT TIME ZONE 'Europe/Bucharest')::date AS day,
      count(*)::bigint AS clicks
    FROM current_rows
    GROUP BY (clicked_at AT TIME ZONE 'Europe/Bucharest')::date
  ),
  daily_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'date', days.day,
        'clicks', COALESCE(daily_stats.clicks, 0)::bigint
      ) ORDER BY days.day
    ), '[]'::jsonb) AS value
    FROM days
    LEFT JOIN daily_stats ON daily_stats.day = days.day
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'clicks', totals.clicks,
      'previous_clicks', previous_totals.clicks,
      'total_links', (SELECT count(*) FROM owned_links),
      'links_with_clicks', totals.links_with_clicks,
      'source_count', totals.source_count,
      'unknown_clicks', totals.unknown_clicks,
      'range_start', range_start,
      'range_end', range_end,
      'previous_range_start', previous_start,
      'previous_range_end', previous_end,
      'is_partial', is_partial,
      'traffic', normalized_traffic
    ),
    'links', links_json.value,
    'sources', sources_json.value,
    'daily', daily_json.value
  ) INTO result
  FROM totals
  CROSS JOIN previous_totals
  CROSS JOIN links_json
  CROSS JOIN sources_json
  CROSS JOIN daily_json;

  RETURN result;
END
$$;

REVOKE ALL ON FUNCTION public.wiseurl_overview_report(date, date, text, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wiseurl_overview_report(date, date, text, uuid, text, timestamptz) TO authenticated;
