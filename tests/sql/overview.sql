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
\ir ../../supabase/migrations/0002_overview.sql
\ir ../../supabase/migrations/0002_overview.sql

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

INSERT INTO public.links (id, code, destination_url, title, user_id, group_id, is_active) VALUES
  ('11111111-1111-4111-8111-111111111111', 'current-main', 'https://merchant.example/main', 'Current main', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', true),
  ('11111111-1111-4111-8111-111111111112', 'prior-only', 'https://merchant.example/prior', 'Prior only', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', false),
  ('11111111-1111-4111-8111-111111111113', 'zero-traffic', 'https://merchant.example/zero', NULL, '10000000-0000-4000-8000-000000000001', NULL, true),
  ('22222222-2222-4222-8222-222222222222', 'other-owner', 'https://private.example/secret', 'Other owner', '20000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', true);

INSERT INTO public.clicks (link_id, code, original_referrer, is_bot, clicked_at, utm_source)
SELECT
  '11111111-1111-4111-8111-111111111111',
  'current-main',
  'https://publisher.example/article',
  sequence <= 5,
  '2024-04-10 10:00:00+00'::timestamptz + (sequence || ' milliseconds')::interval,
  'Site A'
FROM generate_series(1, 1205) AS sequence;

INSERT INTO public.clicks (link_id, code, original_referrer, is_bot, clicked_at, utm_source) VALUES
  ('11111111-1111-4111-8111-111111111111', 'current-main', NULL, false, '2024-04-10 11:00:00+00', NULL),
  ('11111111-1111-4111-8111-111111111111', 'current-main', NULL, false, '2024-04-10 11:01:00+00', 'Unknown source'),
  ('11111111-1111-4111-8111-111111111112', 'prior-only', NULL, false, '2024-04-09 10:00:00+00', 'Stopped Site'),
  ('22222222-2222-4222-8222-222222222222', 'other-owner', NULL, false, '2024-04-10 12:00:00+00', 'Private Site');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);

DO $$
DECLARE
  report jsonb;
  link_row jsonb;
  source_row jsonb;
BEGIN
  report := public.wiseurl_overview_report('2024-04-10', '2024-04-10');
  ASSERT (report #>> '{summary,clicks}')::integer = 1202, 'non-bot default must aggregate beyond 1,000 rows';
  ASSERT (report #>> '{summary,previous_clicks}')::integer = 1, 'previous total mismatch';
  ASSERT (report #>> '{summary,total_links}')::integer = 3, 'all owned links must be counted';
  ASSERT (report #>> '{summary,links_with_clicks}')::integer = 1, 'links-with-clicks mismatch';
  ASSERT (report #>> '{summary,source_count}')::integer = 2, 'identified source count must exclude unknown-kind traffic';
  ASSERT (report #>> '{summary,unknown_clicks}')::integer = 1, 'explicit Unknown source label must not count as unknown provenance';
  ASSERT report #>> '{summary,traffic}' = 'non_bot', 'default traffic mode mismatch';
  ASSERT jsonb_array_length(report -> 'links') = 3, 'zero and prior-only links must remain visible';
  ASSERT jsonb_array_length(report -> 'daily') = 1, 'daily series must fill every requested calendar date';
  ASSERT report #>> '{daily,0,date}' = '2024-04-10', 'daily date mismatch';
  ASSERT (report #>> '{daily,0,clicks}')::integer = 1202, 'daily traffic predicate diverged';
  ASSERT NOT (report -> 'sources') @> '[{"source":"Private Site"}]'::jsonb, 'other owner source leaked';

  SELECT value INTO link_row FROM jsonb_array_elements(report -> 'links') value WHERE value ->> 'code' = 'prior-only';
  ASSERT (link_row ->> 'clicks')::integer = 0, 'prior-only link has current clicks';
  ASSERT (link_row ->> 'previous_clicks')::integer = 1, 'prior-only link previous clicks missing';
  ASSERT link_row ->> 'leading_source' IS NULL, 'prior-only link has current leading source';
  ASSERT link_row ->> 'latest_click' IS NULL, 'prior-only link has current latest click';

  SELECT value INTO link_row FROM jsonb_array_elements(report -> 'links') value WHERE value ->> 'code' = 'zero-traffic';
  ASSERT (link_row ->> 'clicks')::integer = 0 AND (link_row ->> 'previous_clicks')::integer = 0,
    'zero-traffic link did not remain zero';

  SELECT value INTO source_row FROM jsonb_array_elements(report -> 'sources') value WHERE value ->> 'source' = 'Stopped Site';
  ASSERT (source_row ->> 'clicks')::integer = 0 AND (source_row ->> 'previous_clicks')::integer = 1,
    'prior-only source must remain visible';
  ASSERT source_row ->> 'leading_link_code' IS NULL, 'prior-only source has current leading link';

  report := public.wiseurl_overview_report('2024-04-10', '2024-04-10', NULL, NULL, 'all');
  ASSERT (report #>> '{summary,clicks}')::integer = 1207, 'all-traffic total mismatch';
  ASSERT (report #>> '{daily,0,clicks}')::integer = 1207, 'all-traffic daily mismatch';
  ASSERT ((SELECT value ->> 'clicks' FROM jsonb_array_elements(report -> 'links') value WHERE value ->> 'code' = 'current-main'))::integer = 1207,
    'all-traffic link total mismatch';

  report := public.wiseurl_overview_report('2024-04-10', '2024-04-10', NULL, NULL, 'bots');
  ASSERT (report #>> '{summary,clicks}')::integer = 5, 'bot total mismatch';
  ASSERT (report #>> '{summary,unknown_clicks}')::integer = 0, 'bot unknown total mismatch';
  ASSERT (report #>> '{summary,source_count}')::integer = 1, 'bot source count mismatch';
  ASSERT (report #>> '{daily,0,clicks}')::integer = 5, 'bot daily mismatch';

  report := public.wiseurl_overview_report('2024-04-10', '2024-04-10', 'Site A');
  ASSERT (report #>> '{summary,clicks}')::integer = 1200, 'source filter mismatch';
  ASSERT (report #>> '{summary,total_links}')::integer = 3, 'source filter must not remove scoped owned links';
  ASSERT jsonb_array_length(report -> 'sources') = 1, 'source filter returned unrelated sources';

  report := public.wiseurl_overview_report('2024-04-10', '2024-04-10', NULL, '11000000-0000-4000-8000-000000000001');
  ASSERT (report #>> '{summary,total_links}')::integer = 2, 'group link count mismatch';
  ASSERT jsonb_array_length(report -> 'links') = 2, 'group link scope mismatch';

  report := public.wiseurl_overview_report('2024-03-31', '2024-03-31', NULL, NULL, 'non_bot', '2024-03-31 21:00:00+00');
  ASSERT extract(epoch FROM ((report #>> '{summary,range_end}')::timestamptz - (report #>> '{summary,range_start}')::timestamptz)) = 82800,
    'Bucharest DST day must be 23 elapsed hours';
  ASSERT extract(epoch FROM ((report #>> '{summary,previous_range_end}')::timestamptz - (report #>> '{summary,previous_range_start}')::timestamptz)) = 82800,
    'DST comparison must preserve equal elapsed duration';
  ASSERT ((report #>> '{summary,previous_range_start}')::timestamptz AT TIME ZONE 'Europe/Bucharest')::date = '2024-03-30'::date,
    'previous range must anchor at the prior Bucharest calendar interval';

  report := public.wiseurl_overview_report('2024-10-27', '2024-10-27', NULL, NULL, 'non_bot', '2024-10-27 22:00:00+00');
  ASSERT extract(epoch FROM ((report #>> '{summary,range_end}')::timestamptz - (report #>> '{summary,range_start}')::timestamptz)) = 90000,
    'Bucharest fall-back day must be 25 elapsed hours';
  ASSERT extract(epoch FROM ((report #>> '{summary,previous_range_end}')::timestamptz - (report #>> '{summary,previous_range_start}')::timestamptz)) = 90000,
    'fall-back comparison must preserve equal elapsed duration after overlap cap';
  ASSERT (report #>> '{summary,previous_range_end}')::timestamptz = (report #>> '{summary,range_start}')::timestamptz,
    'fall-back previous range must not overlap current range';

  report := public.wiseurl_overview_report('2024-04-10', '2024-04-10', NULL, NULL, 'non_bot', '2024-04-10 12:00:00+00');
  ASSERT (report #>> '{summary,is_partial}')::boolean, 'frozen intraday range must be partial';
  ASSERT (report #>> '{summary,range_end}')::timestamptz = '2024-04-10 12:00:00+00'::timestamptz,
    'as-of boundary mismatch';
  ASSERT (report #>> '{summary,previous_range_start}')::timestamptz = '2024-04-08 21:00:00+00'::timestamptz,
    'partial previous range must start at yesterday midnight in Bucharest';
  ASSERT (report #>> '{summary,previous_range_end}')::timestamptz = '2024-04-09 12:00:00+00'::timestamptz,
    'partial previous range must end at yesterday matching elapsed time';
  ASSERT extract(epoch FROM ((report #>> '{summary,previous_range_end}')::timestamptz - (report #>> '{summary,previous_range_start}')::timestamptz)) = 54000,
    'partial previous range must use equal elapsed duration';
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.wiseurl_overview_report('2024-01-01', '2025-01-01');
    RAISE EXCEPTION 'expected oversized range rejection';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.wiseurl_overview_report('2024-04-10', '2024-04-10', NULL, NULL, 'people');
    RAISE EXCEPTION 'expected invalid traffic rejection';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.wiseurl_overview_report('2024-04-10', '2024-04-10', NULL, NULL, 'non_bot', '2024-04-09 20:59:59+00');
    RAISE EXCEPTION 'expected pre-range as-of rejection';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);

DO $$
BEGIN
  ASSERT has_function_privilege('authenticated', 'public.wiseurl_overview_report(date,date,text,uuid,text,timestamptz)', 'EXECUTE'),
    'authenticated role needs overview execute';
  ASSERT NOT has_function_privilege('anon', 'public.wiseurl_overview_report(date,date,text,uuid,text,timestamptz)', 'EXECUTE'),
    'anon must not execute overview';
  ASSERT NOT has_function_privilege('public', 'public.wiseurl_overview_report(date,date,text,uuid,text,timestamptz)', 'EXECUTE'),
    'public must not execute overview';
END
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);

DO $$
DECLARE report jsonb;
BEGIN
  report := public.wiseurl_overview_report('2024-04-10', '2024-04-10');
  ASSERT (report #>> '{summary,clicks}')::integer = 1, 'owner two total mismatch';
  ASSERT (report #>> '{summary,total_links}')::integer = 1, 'owner two link count mismatch';
  ASSERT NOT (report -> 'links') @> '[{"code":"current-main"}]'::jsonb, 'owner one link leaked';
END
$$;
