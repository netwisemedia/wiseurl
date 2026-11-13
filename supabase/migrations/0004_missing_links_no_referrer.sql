-- Missing-link reporting, revision 2.
--   * requests with no usable referrer are counted under the label 'direct / no referrer'
--     (the coupon site's buttons use rel="noreferrer");
--   * each row carries today / yesterday / last 7 days / last 30 days request counts
--     (Europe/Bucharest calendar days, honoring the traffic filter, independent of the selected range).
--
-- No-referrer attribution rule: a request without a usable referrer (NULL, empty, non-http(s) or
-- unparseable) has no owner of its own. It is attributed to the requesting user only when exactly one
-- user owns reporting sources in wiseurl_reporting_sources and that user is the caller. With zero or
-- several source owners, no-referrer requests are not attributed to anyone. Requests carrying a
-- referrer from a host that is not one of the caller's approved sources stay excluded.
--
-- Same signature as 0003: CREATE OR REPLACE, grants unchanged, safe to rerun. The JSON result only
-- gains fields, so the previous application version keeps working against it.

CREATE OR REPLACE FUNCTION public.wiseurl_missing_links_report(
  p_from date,
  p_to date,
  p_traffic text DEFAULT 'non_bot',
  p_as_of timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  requesting_user uuid;
  range_start timestamptz;
  range_full_end timestamptz;
  range_end timestamptz;
  previous_start timestamptz;
  previous_end timestamptz;
  today_bucharest date;
  normalized_traffic text;
  is_partial boolean;
  window_start timestamptz;
  window_end timestamptz;
  today_start timestamptz;
  yesterday_start timestamptz;
  last_7d_start timestamptz;
  last_30d_start timestamptz;
  result jsonb;
BEGIN
  requesting_user := auth.uid();
  IF requesting_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  today_bucharest := (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date;
  normalized_traffic := COALESCE(NULLIF(btrim(p_traffic), ''), 'non_bot');

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid missing-link date range' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from + 1 > 366 THEN
    RAISE EXCEPTION 'Missing-link date range cannot exceed 366 days' USING ERRCODE = '22023';
  END IF;
  IF p_from > today_bucharest OR p_to > today_bucharest THEN
    RAISE EXCEPTION 'Missing-link date range cannot be in the future' USING ERRCODE = '22023';
  END IF;
  IF normalized_traffic NOT IN ('non_bot', 'all', 'bots') THEN
    RAISE EXCEPTION 'Invalid missing-link traffic mode' USING ERRCODE = '22023';
  END IF;

  range_start := p_from::timestamp AT TIME ZONE 'Europe/Bucharest';
  range_full_end := (p_to + 1)::timestamp AT TIME ZONE 'Europe/Bucharest';
  IF p_as_of IS NOT NULL AND p_as_of < range_start THEN
    RAISE EXCEPTION 'Missing-link as-of time cannot precede range start' USING ERRCODE = '22023';
  END IF;

  range_end := LEAST(range_full_end, COALESCE(p_as_of, statement_timestamp()), statement_timestamp());
  previous_start := (p_from - (p_to - p_from + 1))::timestamp AT TIME ZONE 'Europe/Bucharest';
  previous_end := LEAST(range_start, previous_start + (range_end - range_start));
  previous_start := previous_end - (range_end - range_start);
  is_partial := range_end < range_full_end;

  today_start := today_bucharest::timestamp AT TIME ZONE 'Europe/Bucharest';
  yesterday_start := (today_bucharest - 1)::timestamp AT TIME ZONE 'Europe/Bucharest';
  last_7d_start := (today_bucharest - 6)::timestamp AT TIME ZONE 'Europe/Bucharest';
  last_30d_start := (today_bucharest - 29)::timestamp AT TIME ZONE 'Europe/Bucharest';
  window_start := LEAST(previous_start, last_30d_start);
  window_end := statement_timestamp();

  WITH owned_sources AS (
    SELECT source.hostname
    FROM public.wiseurl_reporting_sources source
    WHERE source.user_id = requesting_user
  ),
  no_referrer_owner AS (
    -- true only when the caller is the single user that owns reporting sources
    SELECT COALESCE(count(DISTINCT sources.user_id) = 1 AND bool_and(sources.user_id = requesting_user), false) AS ok
    FROM public.wiseurl_reporting_sources sources
  ),
  attributed AS (
    SELECT logs.code::text AS code, logs.created_at,
      COALESCE(source.hostname, 'direct / no referrer') AS source
    FROM public.error_404_logs logs
    LEFT JOIN owned_sources source
      ON source.hostname = public.wiseurl_normalize_referrer(logs.original_referrer)
    WHERE logs.created_at >= window_start
      AND logs.created_at < window_end
      AND CASE normalized_traffic
        WHEN 'non_bot' THEN NOT COALESCE(logs.is_bot, false)
        WHEN 'bots' THEN COALESCE(logs.is_bot, false)
        ELSE true
      END
      AND (
        source.hostname IS NOT NULL
        OR ((SELECT ok FROM no_referrer_owner) AND public.wiseurl_normalize_referrer(logs.original_referrer) IS NULL)
      )
  ),
  scoped AS (
    SELECT code, created_at, source FROM attributed
    WHERE created_at >= previous_start AND created_at < range_end
  ),
  period_stats AS (
    SELECT code,
      count(*) FILTER (WHERE created_at >= today_start)::bigint AS today_requests,
      count(*) FILTER (WHERE created_at >= yesterday_start AND created_at < today_start)::bigint AS yesterday_requests,
      count(*) FILTER (WHERE created_at >= last_7d_start)::bigint AS last_7d_requests,
      count(*) FILTER (WHERE created_at >= last_30d_start)::bigint AS last_30d_requests
    FROM attributed
    GROUP BY code
  ),
  current_rows AS (
    SELECT * FROM scoped WHERE created_at >= range_start AND created_at < range_end
  ),
  previous_rows AS (
    SELECT * FROM scoped WHERE created_at >= previous_start AND created_at < previous_end
  ),
  current_stats AS (
    SELECT code, count(*)::bigint AS requests, max(created_at) AS last_seen
    FROM current_rows
    GROUP BY code
  ),
  previous_stats AS (
    SELECT code, count(*)::bigint AS previous_requests, max(created_at) AS last_seen
    FROM previous_rows
    GROUP BY code
  ),
  codes AS (
    SELECT code FROM current_stats
    UNION
    SELECT code FROM previous_stats
  ),
  current_source_ranked AS (
    SELECT code, source,
      row_number() OVER (PARTITION BY code ORDER BY count(*) DESC, source) AS rank
    FROM current_rows
    GROUP BY code, source
  ),
  owned_links AS (
    SELECT links.id, links.code::text AS code, links.is_active
    FROM public.links links
    WHERE links.user_id = requesting_user
  ),
  report_rows AS (
    SELECT
      codes.code,
      COALESCE(current_stats.requests, 0)::bigint AS requests,
      COALESCE(previous_stats.previous_requests, 0)::bigint AS previous_requests,
      GREATEST(current_stats.last_seen, previous_stats.last_seen) AS last_seen,
      source_leader.source AS leading_source,
      CASE
        WHEN owned_links.id IS NULL THEN 'missing'
        WHEN owned_links.is_active THEN 'resolved'
        ELSE 'inactive'
      END AS status,
      owned_links.id AS link_id,
      COALESCE(period_stats.today_requests, 0)::bigint AS today_requests,
      COALESCE(period_stats.yesterday_requests, 0)::bigint AS yesterday_requests,
      COALESCE(period_stats.last_7d_requests, 0)::bigint AS last_7d_requests,
      COALESCE(period_stats.last_30d_requests, 0)::bigint AS last_30d_requests
    FROM codes
    LEFT JOIN current_stats USING (code)
    LEFT JOIN previous_stats USING (code)
    LEFT JOIN current_source_ranked source_leader ON source_leader.code = codes.code AND source_leader.rank = 1
    LEFT JOIN period_stats ON period_stats.code = codes.code
    LEFT JOIN owned_links ON owned_links.code = codes.code
  ),
  rows_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'code', rows.code,
        'requests', rows.requests,
        'previous_requests', rows.previous_requests,
        'last_seen', rows.last_seen,
        'leading_source', rows.leading_source,
        'status', rows.status,
        'link_id', rows.link_id,
        'today_requests', rows.today_requests,
        'yesterday_requests', rows.yesterday_requests,
        'last_7d_requests', rows.last_7d_requests,
        'last_30d_requests', rows.last_30d_requests
      ) ORDER BY rows.requests DESC, rows.previous_requests DESC, rows.code
    ), '[]'::jsonb) AS value
    FROM report_rows rows
  ),
  totals AS (
    SELECT count(*)::bigint AS requests FROM current_rows
  ),
  previous_totals AS (
    SELECT count(*)::bigint AS requests FROM previous_rows
  ),
  sources_json AS (
    SELECT COALESCE(jsonb_agg(hostname ORDER BY hostname), '[]'::jsonb) AS value
    FROM owned_sources
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'requests', totals.requests,
      'previous_requests', previous_totals.requests,
      'range_start', range_start,
      'range_end', range_end,
      'previous_range_start', previous_start,
      'previous_range_end', previous_end,
      'is_partial', is_partial,
      'traffic', normalized_traffic,
      'sources_configured', sources_json.value,
      'includes_no_referrer', (SELECT ok FROM no_referrer_owner)
    ),
    'rows', rows_json.value
  ) INTO result
  FROM totals
  CROSS JOIN previous_totals
  CROSS JOIN sources_json
  CROSS JOIN rows_json;

  RETURN result;
END
$$;

REVOKE ALL ON FUNCTION public.wiseurl_missing_links_report(date, date, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wiseurl_missing_links_report(date, date, text, timestamptz) TO authenticated;
