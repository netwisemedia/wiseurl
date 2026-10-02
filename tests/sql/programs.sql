\set ON_ERROR_STOP on

-- Run against a disposable local PostgreSQL database with:
-- psql -X -v ON_ERROR_STOP=1 -f tests/sql/programs.sql
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.links (
  code varchar(50) UNIQUE NOT NULL,
  destination_url text NOT NULL,
  is_active boolean,
  user_id uuid REFERENCES auth.users(id)
);

\ir ../../supabase/migrations/0002_programs.sql
\ir ../../supabase/migrations/0002_programs.sql

INSERT INTO auth.users VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
INSERT INTO public.links VALUES
  ('Dotted.Code', 'https://owner.example', true, '11111111-1111-1111-1111-111111111111'),
  ('link-only', 'https://new.example', false, '11111111-1111-1111-1111-111111111111'),
  ('foreign', 'https://foreign.example', true, '22222222-2222-2222-2222-222222222222');
INSERT INTO public.swiftpilot_reader_scope (owner_user_id)
VALUES ('11111111-1111-1111-1111-111111111111');
INSERT INTO public.programs (user_id, code, network, access, notes) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dotted.Code', 'Impact', 'approved', 'private'),
  ('11111111-1111-1111-1111-111111111111', 'pre.Link', 'Awin', NULL, 'private');

GRANT authenticated, swiftpilot_reader TO CURRENT_USER;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

SET ROLE swiftpilot_reader;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.swiftpilot_programs_v1) <> 3 THEN
    RAISE EXCEPTION 'reader must see joined, link-only, and program-only owner rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.swiftpilot_programs_v1 WHERE code = 'foreign') THEN
    RAISE EXCEPTION 'foreign owner leaked';
  END IF;
  IF (SELECT destination_url FROM public.swiftpilot_programs_v1 WHERE code = 'Dotted.Code') <> 'https://owner.example' THEN
    RAISE EXCEPTION 'exact code join failed';
  END IF;
  IF has_table_privilege(current_user, 'public.programs', 'SELECT') OR
     has_table_privilege(current_user, 'public.swiftpilot_programs_v1', 'UPDATE') THEN
    RAISE EXCEPTION 'reader has excessive privileges';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'swiftpilot_programs_v1' AND column_name = 'notes'
  ) THEN
    RAISE EXCEPTION 'notes exposed in view';
  END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
SET ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.programs) THEN
    RAISE EXCEPTION 'authenticated foreign user can read owner programs';
  END IF;
  IF has_table_privilege(current_user, 'public.programs', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated user can delete programs';
  END IF;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF has_table_privilege('anon', 'public.programs', 'SELECT') OR
     has_table_privilege('anon', 'public.swiftpilot_programs_v1', 'SELECT') THEN
    RAISE EXCEPTION 'anonymous role can read programs';
  END IF;
END $$;
