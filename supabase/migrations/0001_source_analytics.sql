-- WiseURL source-site attribution and owner-scoped analytics.
-- Run after supabase/schema.sql and before deploying application code that writes
-- the new columns. All table changes and indexes are additive and idempotent.

ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS click_id uuid,
  ADD COLUMN IF NOT EXISTS utm_source varchar(255),
  ADD COLUMN IF NOT EXISTS utm_medium varchar(255),
  ADD COLUMN IF NOT EXISTS utm_campaign varchar(255),
  ADD COLUMN IF NOT EXISTS utm_content varchar(255),
  ADD COLUMN IF NOT EXISTS utm_term varchar(255),
  ADD COLUMN IF NOT EXISTS sub_id1 varchar(255),
  ADD COLUMN IF NOT EXISTS sub_id2 varchar(255),
  ADD COLUMN IF NOT EXISTS sub_id3 varchar(255),
  ADD COLUMN IF NOT EXISTS query_params jsonb,
  ADD COLUMN IF NOT EXISTS source_label varchar(255),
  ADD COLUMN IF NOT EXISTS source_kind varchar(20),
  ADD COLUMN IF NOT EXISTS destination_url_snapshot text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clicks'::regclass
      AND conname = 'clicks_source_kind_check'
  ) THEN
    ALTER TABLE public.clicks
      ADD CONSTRAINT clicks_source_kind_check
      CHECK (source_kind IS NULL OR source_kind IN ('explicit', 'referrer', 'unknown'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clicks_click_id
  ON public.clicks(click_id) WHERE click_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_utm_source
  ON public.clicks(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_utm_campaign
  ON public.clicks(utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_sub_id1
  ON public.clicks(sub_id1) WHERE sub_id1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_source_label
  ON public.clicks(source_label) WHERE source_label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clicks_link_time
  ON public.clicks(link_id, clicked_at DESC);

CREATE OR REPLACE FUNCTION public.wiseurl_normalize_referrer(p_referrer text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  authority text;
  hostname text;
  port_text text;
BEGIN
  IF p_referrer !~* '^https?://' THEN
    RETURN NULL;
  END IF;

  authority := substring(p_referrer FROM '(?i)^https?://([^/?#]+)');
  IF authority IS NULL OR position('@' IN authority) > 0 OR authority LIKE '[%' THEN
    RETURN NULL;
  END IF;

  IF authority LIKE '%:%' THEN
    IF length(authority) - length(replace(authority, ':', '')) <> 1 THEN
      RETURN NULL;
    END IF;
    port_text := substring(authority FROM ':([^:]*)$');
    IF port_text IS NULL OR port_text !~ '^[0-9]+$' OR port_text::numeric > 65535 THEN
      RETURN NULL;
    END IF;
  END IF;

  hostname := lower(split_part(authority, ':', 1));
  hostname := regexp_replace(hostname, '\.$', '');
  hostname := regexp_replace(hostname, '^www\.', '');

  IF hostname = '' OR hostname !~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$' THEN
    RETURN NULL;
  END IF;

  RETURN hostname;
END
$$;

CREATE OR REPLACE FUNCTION public.wiseurl_source_label(
  p_utm_source text,
  p_stored_label text,
  p_stored_kind text,
  p_referrer text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  referrer_host text;
BEGIN
  IF NULLIF(btrim(p_utm_source, E' \t\n\r\f\v'), '') IS NOT NULL THEN
    RETURN left(btrim(p_utm_source, E' \t\n\r\f\v'), 255);
  END IF;

  IF p_stored_kind = 'explicit' AND NULLIF(btrim(p_stored_label, E' \t\n\r\f\v'), '') IS NOT NULL THEN
    RETURN left(btrim(p_stored_label, E' \t\n\r\f\v'), 255);
  END IF;

  referrer_host := public.wiseurl_normalize_referrer(p_referrer);
  IF referrer_host IS NOT NULL THEN
    RETURN referrer_host;
  END IF;

  IF p_stored_kind = 'referrer' AND NULLIF(btrim(p_stored_label, E' \t\n\r\f\v'), '') IS NOT NULL THEN
    RETURN left(lower(btrim(p_stored_label, E' \t\n\r\f\v')), 255);
  END IF;

  RETURN 'Unknown source';
END
$$;

CREATE OR REPLACE FUNCTION public.wiseurl_source_kind(
  p_utm_source text,
  p_stored_label text,
  p_stored_kind text,
  p_referrer text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(p_utm_source, E' \t\n\r\f\v'), '') IS NOT NULL THEN 'explicit'
    WHEN p_stored_kind = 'explicit' AND NULLIF(btrim(p_stored_label, E' \t\n\r\f\v'), '') IS NOT NULL THEN 'explicit'
    WHEN public.wiseurl_normalize_referrer(p_referrer) IS NOT NULL THEN 'referrer'
    WHEN p_stored_kind = 'referrer' AND NULLIF(btrim(p_stored_label, E' \t\n\r\f\v'), '') IS NOT NULL THEN 'referrer'
    ELSE 'unknown'
  END
$$;

DROP FUNCTION IF EXISTS public.wiseurl_analytics_report(date, date, text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.wiseurl_analytics_report(
  p_from date,
  p_to date,
  p_source text DEFAULT NULL,
  p_link_id uuid DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
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
  now_bucharest_date date;
  is_partial boolean;
  result jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid analytics date range' USING ERRCODE = '22023';
  END IF;

  now_bucharest_date := (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date;
  IF p_from > now_bucharest_date OR p_to > now_bucharest_date THEN
    RAISE EXCEPTION 'Analytics date range cannot be in the future' USING ERRCODE = '22023';
  END IF;

  range_start := p_from::timestamp AT TIME ZONE 'Europe/Bucharest';
  range_full_end := (p_to + 1)::timestamp AT TIME ZONE 'Europe/Bucharest';
  range_end := LEAST(range_full_end, COALESCE(p_as_of, statement_timestamp()), statement_timestamp());
  previous_start := range_start - (range_end - range_start);
  is_partial := range_end < range_full_end;

  WITH owned AS (
    SELECT
      c.*,
      l.title,
      COALESCE(c.destination_url_snapshot, l.destination_url) AS destination_url,
      l.group_id
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE l.user_id = auth.uid()
      AND (p_link_id IS NULL OR l.id = p_link_id)
      AND (p_group_id IS NULL OR l.group_id = p_group_id)
      AND c.clicked_at >= previous_start
      AND c.clicked_at < range_end
  ),
  attributed AS (
    SELECT
      owned.*,
      public.wiseurl_source_label(utm_source, source_label, source_kind, original_referrer) AS resolved_source,
      public.wiseurl_source_kind(utm_source, source_label, source_kind, original_referrer) AS resolved_kind
    FROM owned
  ),
  scoped AS (
    SELECT * FROM attributed
    WHERE p_source IS NULL OR resolved_source = p_source
  ),
  current_rows AS (
    SELECT * FROM scoped WHERE clicked_at >= range_start AND clicked_at < range_end
  ),
  previous_rows AS (
    SELECT * FROM scoped WHERE clicked_at >= previous_start AND clicked_at < range_start
  ),
  totals AS (
    SELECT
      count(*)::bigint AS recorded_clicks,
      count(*) FILTER (WHERE NOT is_bot)::bigint AS recorded_non_bot_clicks,
      count(*) FILTER (WHERE is_bot)::bigint AS bot_clicks
    FROM current_rows
  ),
  previous_totals AS (
    SELECT
      count(*)::bigint AS recorded_clicks,
      count(*) FILTER (WHERE NOT is_bot)::bigint AS recorded_non_bot_clicks,
      count(*) FILTER (WHERE is_bot)::bigint AS bot_clicks
    FROM previous_rows
  ),
  source_stats AS (
    SELECT
      resolved_source AS source,
      CASE WHEN count(DISTINCT resolved_kind) = 1 THEN min(resolved_kind) ELSE 'mixed' END AS provenance,
      count(*)::bigint AS clicks,
      count(*) FILTER (WHERE NOT is_bot)::bigint AS non_bot_clicks,
      count(*) FILTER (WHERE is_bot)::bigint AS bot_clicks,
      max(clicked_at) AS latest_click
    FROM current_rows
    GROUP BY resolved_source
  ),
  source_previous AS (
    SELECT
      resolved_source AS source,
      CASE WHEN count(DISTINCT resolved_kind) = 1 THEN min(resolved_kind) ELSE 'mixed' END AS provenance,
      count(*)::bigint AS clicks
    FROM previous_rows
    GROUP BY resolved_source
  ),
  source_comparison AS (
    SELECT
      COALESCE(stats.source, previous.source) AS source,
      COALESCE(stats.provenance, previous.provenance) AS provenance,
      COALESCE(stats.clicks, 0)::bigint AS clicks,
      COALESCE(stats.non_bot_clicks, 0)::bigint AS non_bot_clicks,
      COALESCE(stats.bot_clicks, 0)::bigint AS bot_clicks,
      COALESCE(previous.clicks, 0)::bigint AS previous_clicks,
      stats.latest_click
    FROM source_stats stats
    FULL OUTER JOIN source_previous previous USING (source)
  ),
  sources_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'source', comparison.source,
        'provenance', comparison.provenance,
        'clicks', comparison.clicks,
        'recorded_non_bot_clicks', comparison.non_bot_clicks,
        'bot_clicks', comparison.bot_clicks,
        'share', CASE WHEN totals.recorded_clicks = 0 THEN 0 ELSE round(comparison.clicks * 100.0 / totals.recorded_clicks, 1) END,
        'previous_clicks', comparison.previous_clicks,
        'change_state', CASE
          WHEN comparison.previous_clicks = 0 AND comparison.clicks > 0 THEN 'new'
          WHEN comparison.previous_clicks = 0 THEN 'no_baseline'
          WHEN comparison.clicks > comparison.previous_clicks THEN 'increase'
          WHEN comparison.clicks < comparison.previous_clicks THEN 'decrease'
          ELSE 'unchanged'
        END,
        'change_percent', CASE WHEN comparison.previous_clicks = 0 THEN NULL ELSE round((comparison.clicks - comparison.previous_clicks) * 100.0 / comparison.previous_clicks, 1) END,
        'leading_link_code', (
          SELECT cr.code FROM current_rows cr
          WHERE cr.resolved_source = comparison.source
          GROUP BY cr.code ORDER BY count(*) DESC, cr.code LIMIT 1
        ),
        'leading_destination', (
          SELECT cr.destination_url FROM current_rows cr
          WHERE cr.resolved_source = comparison.source
          GROUP BY cr.destination_url ORDER BY count(*) DESC, cr.destination_url LIMIT 1
        ),
        'latest_click', comparison.latest_click
      ) ORDER BY comparison.clicks DESC, comparison.source
    ), '[]'::jsonb) AS value
    FROM source_comparison comparison
    CROSS JOIN totals
  ),
  links_json AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY rows.clicks DESC, rows.code), '[]'::jsonb) AS value
    FROM (
      SELECT
        link_id AS id,
        code,
        max(title) AS title,
        (array_agg(destination_url ORDER BY clicked_at DESC))[1] AS latest_destination_url,
        count(*)::bigint AS clicks,
        count(*) FILTER (WHERE NOT is_bot)::bigint AS recorded_non_bot_clicks,
        count(*) FILTER (WHERE is_bot)::bigint AS bot_clicks,
        max(clicked_at) AS latest_click
      FROM current_rows
      GROUP BY link_id, code
    ) rows
  ),
  destinations_json AS (
    SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY rows.clicks DESC, rows.destination_url), '[]'::jsonb) AS value
    FROM (
      SELECT
        destination_url,
        count(*)::bigint AS clicks,
        count(*) FILTER (WHERE NOT is_bot)::bigint AS recorded_non_bot_clicks,
        count(*) FILTER (WHERE is_bot)::bigint AS bot_clicks,
        count(DISTINCT link_id)::integer AS link_count,
        max(clicked_at) AS latest_click
      FROM current_rows
      GROUP BY destination_url
    ) rows
  ),
  days AS (
    SELECT day::date AS day
    FROM generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') day
  ),
  daily_stats AS (
    SELECT
      days.day,
      count(current_rows.id)::bigint AS clicks,
      count(current_rows.id) FILTER (WHERE NOT current_rows.is_bot)::bigint AS recorded_non_bot_clicks,
      count(current_rows.id) FILTER (WHERE current_rows.is_bot)::bigint AS bot_clicks
    FROM days
    LEFT JOIN current_rows
      ON (current_rows.clicked_at AT TIME ZONE 'Europe/Bucharest')::date = days.day
    GROUP BY days.day
  ),
  daily_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', daily_stats.day,
      'clicks', daily_stats.clicks,
      'recorded_non_bot_clicks', daily_stats.recorded_non_bot_clicks,
      'bot_clicks', daily_stats.bot_clicks
    ) ORDER BY daily_stats.day), '[]'::jsonb) AS value
    FROM daily_stats
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'recorded_clicks', totals.recorded_clicks,
      'recorded_non_bot_clicks', totals.recorded_non_bot_clicks,
      'bot_clicks', totals.bot_clicks,
      'previous_recorded_clicks', previous_totals.recorded_clicks,
      'previous_recorded_non_bot_clicks', previous_totals.recorded_non_bot_clicks,
      'previous_bot_clicks', previous_totals.bot_clicks,
      'change_state', CASE
        WHEN previous_totals.recorded_clicks = 0 AND totals.recorded_clicks > 0 THEN 'new'
        WHEN previous_totals.recorded_clicks = 0 THEN 'no_baseline'
        WHEN totals.recorded_clicks > previous_totals.recorded_clicks THEN 'increase'
        WHEN totals.recorded_clicks < previous_totals.recorded_clicks THEN 'decrease'
        ELSE 'unchanged'
      END,
      'change_percent', CASE WHEN previous_totals.recorded_clicks = 0 THEN NULL ELSE round((totals.recorded_clicks - previous_totals.recorded_clicks) * 100.0 / previous_totals.recorded_clicks, 1) END,
      'timezone', 'Europe/Bucharest',
      'from', p_from,
      'to', p_to,
      'range_start', range_start,
      'range_end', range_end,
      'previous_range_start', previous_start,
      'previous_range_end', range_start,
      'duration_seconds', extract(epoch FROM range_end - range_start),
      'previous_duration_seconds', extract(epoch FROM range_start - previous_start),
      'is_partial', is_partial
    ),
    'sources', sources_json.value,
    'links', links_json.value,
    'destinations', destinations_json.value,
    'daily', daily_json.value
  ) INTO result
  FROM totals
  CROSS JOIN previous_totals
  CROSS JOIN sources_json
  CROSS JOIN links_json
  CROSS JOIN destinations_json
  CROSS JOIN daily_json;

  RETURN result;
END
$$;

DROP FUNCTION IF EXISTS public.wiseurl_analytics_clicks(date, date, text, uuid, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.wiseurl_analytics_clicks(
  p_from date,
  p_to date,
  p_source text DEFAULT NULL,
  p_link_id uuid DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_as_of timestamptz DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  clicked_at timestamptz,
  link_id uuid,
  code text,
  title text,
  destination_url text,
  source text,
  source_kind text,
  original_referrer text,
  country text,
  city text,
  device_type text,
  os_name text,
  browser_name text,
  is_bot boolean,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  sub_id1 text,
  sub_id2 text,
  sub_id3 text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  range_start timestamptz;
  range_full_end timestamptz;
  range_end timestamptz;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid analytics date range' USING ERRCODE = '22023';
  END IF;
  IF p_from > (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date
    OR p_to > (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date THEN
    RAISE EXCEPTION 'Analytics date range cannot be in the future' USING ERRCODE = '22023';
  END IF;

  range_start := p_from::timestamp AT TIME ZONE 'Europe/Bucharest';
  range_full_end := (p_to + 1)::timestamp AT TIME ZONE 'Europe/Bucharest';
  range_end := LEAST(range_full_end, COALESCE(p_as_of, statement_timestamp()), statement_timestamp());

  RETURN QUERY
  WITH rows AS (
    SELECT
      c.id,
      c.clicked_at,
      c.link_id,
      c.code::text,
      l.title::text,
      COALESCE(c.destination_url_snapshot, l.destination_url) AS destination_url,
      public.wiseurl_source_label(c.utm_source, c.source_label, c.source_kind, c.original_referrer) AS source,
      public.wiseurl_source_kind(c.utm_source, c.source_label, c.source_kind, c.original_referrer) AS source_kind,
      c.original_referrer,
      c.country::text,
      c.city::text,
      c.device_type::text,
      c.os_name::text,
      c.browser_name::text,
      c.is_bot,
      c.utm_source::text,
      c.utm_medium::text,
      c.utm_campaign::text,
      c.utm_content::text,
      c.utm_term::text,
      c.sub_id1::text,
      c.sub_id2::text,
      c.sub_id3::text
    FROM public.clicks c
    JOIN public.links l ON l.id = c.link_id
    WHERE l.user_id = auth.uid()
      AND (p_link_id IS NULL OR l.id = p_link_id)
      AND (p_group_id IS NULL OR l.group_id = p_group_id)
      AND c.clicked_at >= range_start
      AND c.clicked_at < range_end
  ),
  scoped AS (
    SELECT * FROM rows WHERE p_source IS NULL OR rows.source = p_source
  )
  SELECT
    scoped.*,
    count(*) OVER () AS total_count
  FROM scoped
  ORDER BY scoped.clicked_at DESC, scoped.id DESC
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
END
$$;

REVOKE ALL ON FUNCTION public.wiseurl_analytics_report(date, date, text, uuid, uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wiseurl_analytics_clicks(date, date, text, uuid, uuid, timestamptz, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wiseurl_analytics_report(date, date, text, uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiseurl_analytics_clicks(date, date, text, uuid, uuid, timestamptz, integer, integer) TO authenticated;

-- Historical 404 rows cannot be assigned safely to a user, so do not expose them.
DROP POLICY IF EXISTS "Users can view 404 logs" ON public.error_404_logs;
REVOKE SELECT ON public.error_404_logs FROM anon, authenticated;
