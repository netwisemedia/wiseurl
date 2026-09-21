\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
$$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user)
$$;

\ir ../../supabase/schema.sql
\ir ../../supabase/migrations/0001_source_analytics.sql
\ir ../../supabase/migrations/0002_overview.sql
\ir ../../supabase/migrations/0003_missing_links.sql
\ir ../../supabase/migrations/0003_missing_links.sql

GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT INSERT ON public.error_404_logs TO anon;

INSERT INTO auth.users (id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');

INSERT INTO public.wiseurl_reporting_sources (hostname, user_id) VALUES
  ('couponswift.com', '10000000-0000-4000-8000-000000000001'),
  ('other-publisher.example', '20000000-0000-4000-8000-000000000002');

INSERT INTO public.links (id, code, destination_url, title, user_id, is_active) VALUES
  ('11111111-1111-4111-8111-111111111111', 'now-resolved', 'https://merchant.example/resolved', 'Resolved', '10000000-0000-4000-8000-000000000001', true),
  ('11111111-1111-4111-8111-111111111112', 'owned-inactive', 'https://merchant.example/inactive', 'Inactive', '10000000-0000-4000-8000-000000000001', false),
  ('22222222-2222-4222-8222-222222222222', 'other-owner', 'https://private.example/secret', 'Private', '20000000-0000-4000-8000-000000000002', true);

INSERT INTO public.error_404_logs (code, original_referrer, is_bot, created_at)
SELECT 'bulk-missing', 'https://www.couponswift.com/company/bulk-missing', sequence <= 5,
  '2024-04-10 10:00:00+00'::timestamptz + (sequence || ' milliseconds')::interval
FROM generate_series(1, 1205) sequence;

INSERT INTO public.error_404_logs (code, original_referrer, is_bot, created_at) VALUES
  ('now-resolved', 'https://couponswift.com/company/now-resolved', false, '2024-04-10 11:00:00+00'),
  ('owned-inactive', 'https://www.couponswift.com/company/owned-inactive', false, '2024-04-10 11:01:00+00'),
  ('Legacy.Bad_Code', 'https://couponswift.com/company/Legacy.Bad_Code', false, '2024-04-10 11:02:00+00'),
  ('prior-only', 'https://couponswift.com/company/prior-only', false, '2024-04-09 10:00:00+00'),
  ('no-referrer', NULL, false, '2024-04-10 12:00:00+00'),
  ('invalid-referrer', 'not a url', false, '2024-04-10 12:01:00+00'),
  ('source-lookalike', 'https://couponswift.com.evil.example/company/x', false, '2024-04-10 12:02:00+00'),
  ('other-owner', 'https://other-publisher.example/company/other-owner', false, '2024-04-10 12:03:00+00');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);

DO $$
DECLARE report jsonb; row_data jsonb;
BEGIN
  report := public.wiseurl_missing_links_report('2024-04-10', '2024-04-10');
  ASSERT (report #>> '{summary,requests}')::integer = 1203, 'non-bot request count must exceed 1,000 without truncation';
  ASSERT (report #>> '{summary,previous_requests}')::integer = 1, 'previous requests mismatch';
  ASSERT report #> '{summary,sources_configured}' = '["couponswift.com"]'::jsonb, 'configured sources mismatch';
  ASSERT jsonb_array_length(report -> 'rows') = 5, 'current and previous codes should be present';
  ASSERT NOT (report -> 'rows') @> '[{"code":"other-owner"}]'::jsonb, 'other tenant code leaked';
  ASSERT NOT (report -> 'rows') @> '[{"code":"source-lookalike"}]'::jsonb, 'hostname lookalike matched';
  ASSERT NOT (report -> 'rows') @> '[{"code":"no-referrer"}]'::jsonb, 'missing referrer matched';

  SELECT value INTO row_data FROM jsonb_array_elements(report -> 'rows') value WHERE value ->> 'code' = 'now-resolved';
  ASSERT row_data ->> 'status' = 'resolved' AND row_data ->> 'link_id' = '11111111-1111-4111-8111-111111111111', 'owned active state mismatch';
  SELECT value INTO row_data FROM jsonb_array_elements(report -> 'rows') value WHERE value ->> 'code' = 'owned-inactive';
  ASSERT row_data ->> 'status' = 'inactive' AND row_data ->> 'link_id' = '11111111-1111-4111-8111-111111111112', 'owned inactive state mismatch';
  SELECT value INTO row_data FROM jsonb_array_elements(report -> 'rows') value WHERE value ->> 'code' = 'prior-only';
  ASSERT (row_data ->> 'requests')::integer = 0 AND (row_data ->> 'previous_requests')::integer = 1, 'prior-only row missing';
  ASSERT row_data ->> 'last_seen' IS NOT NULL, 'prior-only last seen missing';
  SELECT value INTO row_data FROM jsonb_array_elements(report -> 'rows') value WHERE value ->> 'code' = 'Legacy.Bad_Code';
  ASSERT row_data ->> 'status' = 'missing', 'historical code punctuation must be preserved';

  report := public.wiseurl_missing_links_report('2024-04-10', '2024-04-10', 'all');
  ASSERT (report #>> '{summary,requests}')::integer = 1208, 'all traffic count mismatch';
  report := public.wiseurl_missing_links_report('2024-04-10', '2024-04-10', 'bots');
  ASSERT (report #>> '{summary,requests}')::integer = 5, 'bot count mismatch';

  report := public.wiseurl_missing_links_report('2024-03-31', '2024-03-31', 'non_bot', '2024-03-31 21:00:00+00');
  ASSERT extract(epoch FROM ((report #>> '{summary,range_end}')::timestamptz - (report #>> '{summary,range_start}')::timestamptz)) = 82800, 'spring DST range mismatch';
  ASSERT extract(epoch FROM ((report #>> '{summary,previous_range_end}')::timestamptz - (report #>> '{summary,previous_range_start}')::timestamptz)) = 82800, 'spring comparison mismatch';
END
$$;

DO $$ BEGIN
  BEGIN
    INSERT INTO public.wiseurl_reporting_sources (hostname, user_id) VALUES ('self-claim.example', '10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'authenticated user self-claimed a source';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.wiseurl_missing_links_report('2024-01-01', '2025-01-01');
    RAISE EXCEPTION 'oversized range accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', false);

DO $$ BEGIN
  ASSERT has_table_privilege('authenticated', 'public.wiseurl_reporting_sources', 'SELECT'), 'authenticated needs source select';
  ASSERT NOT has_table_privilege('authenticated', 'public.wiseurl_reporting_sources', 'INSERT'), 'authenticated must not insert sources';
  ASSERT NOT has_table_privilege('authenticated', 'public.wiseurl_reporting_sources', 'UPDATE'), 'authenticated must not update sources';
  ASSERT NOT has_table_privilege('anon', 'public.wiseurl_reporting_sources', 'SELECT'), 'anon must not see sources';
  ASSERT has_function_privilege('authenticated', 'public.wiseurl_missing_links_report(date,date,text,timestamptz)', 'EXECUTE'), 'authenticated needs RPC execute';
  ASSERT NOT has_function_privilege('anon', 'public.wiseurl_missing_links_report(date,date,text,timestamptz)', 'EXECUTE'), 'anon must not execute RPC';
  ASSERT NOT has_function_privilege('public', 'public.wiseurl_missing_links_report(date,date,text,timestamptz)', 'EXECUTE'), 'public must not execute RPC';
  ASSERT NOT has_table_privilege('authenticated', 'public.error_404_logs', 'SELECT'), 'global 404 logs must remain private';
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
DO $$ DECLARE report jsonb; BEGIN
  report := public.wiseurl_missing_links_report('2024-04-10', '2024-04-10');
  ASSERT (report #>> '{summary,requests}')::integer = 1, 'owner two count mismatch';
  ASSERT report #> '{summary,sources_configured}' = '["other-publisher.example"]'::jsonb, 'owner two source mismatch';
  ASSERT jsonb_array_length(report -> 'rows') = 1, 'owner two row count mismatch';
  ASSERT NOT (report -> 'rows') @> '[{"code":"bulk-missing"}]'::jsonb, 'owner one data leaked';
END $$;
