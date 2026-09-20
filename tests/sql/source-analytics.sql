\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user)
$$;

\ir ../../supabase/schema.sql
\ir ../../supabase/migrations/0001_source_analytics.sql
\ir ../../supabase/migrations/0001_source_analytics.sql

GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON public.clicks, public.error_404_logs TO anon;

INSERT INTO auth.users (id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');

INSERT INTO public.groups (id, name, user_id) VALUES
  ('11000000-0000-4000-8000-000000000001', 'Owner one group', '10000000-0000-4000-8000-000000000001'),
  ('22000000-0000-4000-8000-000000000002', 'Owner two group', '20000000-0000-4000-8000-000000000002');

INSERT INTO public.links (id, code, destination_url, title, user_id, group_id) VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-one-main', 'https://merchant.example/main?affiliate=owner-one', 'Owner one main', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001'),
  ('11111111-1111-4111-8111-111111111112', 'owner-one-other', 'https://merchant.example/other', 'Owner one other', '10000000-0000-4000-8000-000000000001', NULL),
  ('22222222-2222-4222-8222-222222222222', 'owner-two', 'https://private.example/secret', 'Owner two', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002');

INSERT INTO public.clicks (
  link_id, code, original_referrer, is_bot, clicked_at,
  click_id, utm_source, source_label, source_kind, destination_url_snapshot
)
SELECT
  '11111111-1111-4111-8111-111111111111',
  'owner-one-main',
  'https://ignored.example/article',
  sequence <= 5,
  '2024-04-10 10:00:00+00'::timestamptz + (sequence || ' milliseconds')::interval,
  ('30000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
  'Site A',
  'Site A',
  'explicit',
  'https://merchant.example/original-main?affiliate=owner-one'
FROM generate_series(1, 1205) AS sequence;

-- Historical-style rows leave the derived source fields null.
INSERT INTO public.clicks (link_id, code, original_referrer, is_bot, clicked_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-one-main', 'https://WWW.Example.COM./story', false, '2024-04-10 11:00:00+00'),
  ('11111111-1111-4111-8111-111111111111', 'owner-one-main', 'not a valid referrer', false, '2024-04-10 11:01:00+00'),
  ('11111111-1111-4111-8111-111111111111', 'owner-one-main', NULL, true, '2024-04-10 11:02:00+00');

INSERT INTO public.clicks (link_id, code, original_referrer, is_bot, clicked_at, utm_source) VALUES
  ('11111111-1111-4111-8111-111111111112', 'owner-one-other', 'https://referrer.example/', false, '2024-04-10 12:00:00+00', 'Site B'),
  ('11111111-1111-4111-8111-111111111112', 'owner-one-other', 'https://referrer.example/', false, '2024-04-10 12:01:00+00', 'Site B'),
  ('11111111-1111-4111-8111-111111111112', 'owner-one-other', 'https://referrer.example/', false, '2024-04-10 12:02:00+00', 'Site B'),
  ('11111111-1111-4111-8111-111111111112', 'owner-one-other', 'https://referrer.example/', true, '2024-04-10 12:03:00+00', 'Site B'),
  ('22222222-2222-4222-8222-222222222222', 'owner-two', 'https://private-source.example/', false, '2024-04-10 12:04:00+00', 'Private Site');

INSERT INTO public.clicks (link_id, code, original_referrer, is_bot, clicked_at, utm_source) VALUES
  ('11111111-1111-4111-8111-111111111111', 'owner-one-main', 'https://stopped.example/', false, '2024-04-09 10:00:00+00', 'Stopped Site');

DO $$
BEGIN
  ASSERT public.wiseurl_normalize_referrer('https://a.b.c.d.e.example.com/path') = 'a.b.c.d.e.example.com', 'deep hostname rejected';
  ASSERT public.wiseurl_normalize_referrer('https://example.com:notaport/path') IS NULL, 'invalid text port accepted';
  ASSERT public.wiseurl_normalize_referrer('https://example.com:99999/path') IS NULL, 'out-of-range port accepted';
END
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);

DO $$
DECLARE
  report jsonb;
  source_row jsonb;
  row_count integer;
BEGIN
  report := public.wiseurl_analytics_report('2024-04-10', '2024-04-10', 'Site A', NULL, NULL);
  ASSERT (report #>> '{summary,recorded_clicks}')::integer = 1205, 'aggregate must include all 1,205 rows';
  ASSERT (report #>> '{summary,recorded_non_bot_clicks}')::integer = 1200, 'non-bot split mismatch';
  ASSERT (report #>> '{summary,bot_clicks}')::integer = 5, 'bot split mismatch';
  ASSERT report #>> '{summary,change_state}' = 'new', 'zero previous period must be New';

  SELECT value INTO source_row
  FROM jsonb_array_elements(report -> 'sources') AS value
  WHERE value ->> 'source' = 'Site A';
  ASSERT source_row ->> 'provenance' = 'explicit', 'explicit source provenance missing';
  ASSERT source_row ->> 'leading_link_code' = 'owner-one-main', 'leading link mismatch';
  ASSERT source_row ->> 'leading_destination' = 'https://merchant.example/original-main?affiliate=owner-one', 'destination snapshot not used';

  report := public.wiseurl_analytics_report('2024-04-10', '2024-04-10', NULL, NULL, NULL);
  ASSERT (report #>> '{summary,recorded_clicks}')::integer = 1212, 'owner one total mismatch';
  ASSERT NOT (report -> 'sources') @> '[{"source":"Private Site"}]'::jsonb, 'owner two source leaked';
  ASSERT (report -> 'sources') @> '[{"source":"example.com","provenance":"referrer"}]'::jsonb, 'www referrer normalization failed';
  ASSERT (report -> 'sources') @> '[{"source":"Unknown source","provenance":"unknown"}]'::jsonb, 'unknown source missing';
  ASSERT (report -> 'sources') @> '[{"source":"Stopped Site","clicks":0,"previous_clicks":1,"change_state":"decrease","change_percent":-100.0}]'::jsonb,
    'prior-only source must remain visible as a 100% decrease';

  report := public.wiseurl_analytics_report('2024-04-10', '2024-04-10', NULL, NULL, '11000000-0000-4000-8000-000000000001');
  ASSERT (report #>> '{summary,recorded_clicks}')::integer = 1208, 'group filter mismatch';

  report := public.wiseurl_analytics_report('2024-04-10', '2024-04-10', NULL, '11111111-1111-4111-8111-111111111112', NULL);
  ASSERT (report #>> '{summary,recorded_clicks}')::integer = 4, 'link filter mismatch';

  SELECT count(*) INTO row_count
  FROM public.wiseurl_analytics_clicks('2024-04-10', '2024-04-10', 'Site A', NULL, NULL, NULL, 1000, 500);
  ASSERT row_count = 205, 'raw pagination must reach beyond the REST 1,000-row boundary';

  SELECT count(*) INTO row_count
  FROM public.wiseurl_analytics_clicks('2024-04-10', '2024-04-10', NULL, '22222222-2222-4222-8222-222222222222', NULL, NULL, 0, 50);
  ASSERT row_count = 0, 'raw rows leaked across owners';

  report := public.wiseurl_analytics_report('2024-03-31', '2024-03-31', NULL, NULL, NULL);
  ASSERT (report #>> '{summary,duration_seconds}')::numeric = 82800, 'Bucharest DST day must be 23 elapsed hours';
  ASSERT report #>> '{summary,change_state}' = 'no_baseline', 'empty periods must be No baseline';

  report := public.wiseurl_analytics_report(
    (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date,
    (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date,
    NULL, NULL, NULL
  );
  ASSERT (report #>> '{summary,is_partial}')::boolean, 'current day must be marked partial';
  ASSERT (report #>> '{summary,duration_seconds}')::numeric = (report #>> '{summary,previous_duration_seconds}')::numeric,
    'partial comparison must use the exact same elapsed duration';
END
$$;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);

DO $$
DECLARE
  report jsonb;
BEGIN
  report := public.wiseurl_analytics_report('2024-04-10', '2024-04-10', NULL, NULL, NULL);
  ASSERT (report #>> '{summary,recorded_clicks}')::integer = 1, 'owner two must see only its own click';
  ASSERT (report -> 'sources') @> '[{"source":"Private Site"}]'::jsonb, 'owner two source missing';
END
$$;

RESET ROLE;

DO $$
DECLARE
  report_oid oid;
  raw_oid oid;
BEGIN
  SELECT oid INTO report_oid FROM pg_proc WHERE oid = 'public.wiseurl_analytics_report(date,date,text,uuid,uuid)'::regprocedure;
  SELECT oid INTO raw_oid FROM pg_proc WHERE oid = 'public.wiseurl_analytics_clicks(date,date,text,uuid,uuid,timestamp with time zone,integer,integer)'::regprocedure;

  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = report_oid), 'report must be security invoker';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = raw_oid), 'raw query must be security invoker';
  ASSERT (SELECT proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = report_oid), 'report search_path not pinned';
  ASSERT has_function_privilege('authenticated', report_oid, 'EXECUTE'), 'authenticated role needs report access';
  ASSERT NOT has_function_privilege('anon', report_oid, 'EXECUTE'), 'anonymous report access must be revoked';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'error_404_logs' AND cmd = 'SELECT'
  ), 'global 404 SELECT policy must be removed';
END
$$;

SELECT 'source analytics SQL assertions passed' AS result;
