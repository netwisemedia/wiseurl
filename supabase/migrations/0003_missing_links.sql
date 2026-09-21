-- Tenant-scoped demand reporting for codes requested from approved publisher sites.
-- Reporting sources are provisioned by an administrator; clients cannot claim domains.

CREATE TABLE IF NOT EXISTS public.wiseurl_reporting_sources (
  hostname text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wiseurl_reporting_sources_normalized_hostname CHECK (
    public.wiseurl_normalize_referrer('https://' || hostname || '/') IS NOT NULL
    AND public.wiseurl_normalize_referrer('https://' || hostname || '/') = hostname
  )
);

CREATE INDEX IF NOT EXISTS idx_wiseurl_reporting_sources_user
  ON public.wiseurl_reporting_sources(user_id, hostname);

CREATE INDEX IF NOT EXISTS idx_error_404_logs_referrer_host_time
  ON public.error_404_logs(public.wiseurl_normalize_referrer(original_referrer), created_at)
  WHERE original_referrer IS NOT NULL;

ALTER TABLE public.wiseurl_reporting_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reporting sources" ON public.wiseurl_reporting_sources;
CREATE POLICY "Users can view own reporting sources" ON public.wiseurl_reporting_sources
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.wiseurl_reporting_sources FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.wiseurl_reporting_sources TO authenticated;

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

  WITH owned_sources AS (
    SELECT source.hostname
    FROM public.wiseurl_reporting_sources source
    WHERE source.user_id = requesting_user
  ),
  scoped AS (
    SELECT logs.code::text AS code, logs.created_at, source.hostname AS source
    FROM public.error_404_logs logs
    JOIN owned_sources source
      ON source.hostname = public.wiseurl_normalize_referrer(logs.original_referrer)
    WHERE logs.created_at >= previous_start
      AND logs.created_at < range_end
      AND CASE normalized_traffic
        WHEN 'non_bot' THEN NOT COALESCE(logs.is_bot, false)
        WHEN 'bots' THEN COALESCE(logs.is_bot, false)
        ELSE true
      END
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
      owned_links.id AS link_id
    FROM codes
    LEFT JOIN current_stats USING (code)
    LEFT JOIN previous_stats USING (code)
    LEFT JOIN current_source_ranked source_leader ON source_leader.code = codes.code AND source_leader.rank = 1
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
        'link_id', rows.link_id
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
      'sources_configured', sources_json.value
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
