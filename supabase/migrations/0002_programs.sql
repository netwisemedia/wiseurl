-- WiseURL programs v1. Apply in the Supabase SQL editor before deploying the UI.
-- This file is additive and may be rerun after a completed application. It does
-- not import or guess affiliate access from existing links.
BEGIN;

CREATE TABLE IF NOT EXISTS public.programs (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  code text NOT NULL CHECK (code <> ''),
  network text,
  program_url text,
  signup_url text,
  commission text,
  cookie_days integer CHECK (cookie_days IS NULL OR cookie_days >= 0),
  access text CHECK (access IN ('approved', 'pending', 'rejected', 'not_applied')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.programs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.programs TO authenticated;

DROP POLICY IF EXISTS programs_owner_select ON public.programs;
CREATE POLICY programs_owner_select ON public.programs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS programs_owner_insert ON public.programs;
CREATE POLICY programs_owner_insert ON public.programs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS programs_owner_update ON public.programs;
CREATE POLICY programs_owner_update ON public.programs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_program_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.set_program_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS programs_updated_at ON public.programs;
CREATE TRIGGER programs_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_program_updated_at();

-- A direct PostgreSQL login has no trustworthy auth.uid(). The operator binds
-- the read projection to one owner after applying the migration. Until then the
-- view is empty. No app or reader role can edit this table.
CREATE TABLE IF NOT EXISTS public.swiftpilot_reader_scope (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id)
);
REVOKE ALL ON TABLE public.swiftpilot_reader_scope FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE VIEW public.swiftpilot_programs_v1
WITH (security_barrier = true) AS
SELECT
  COALESCE(p.code, l.code) AS code,
  p.network,
  p.program_url,
  p.signup_url,
  p.commission,
  p.cookie_days,
  p.access,
  p.updated_at,
  l.destination_url,
  l.is_active
FROM public.programs AS p
FULL OUTER JOIN public.links AS l
  ON p.user_id = l.user_id AND p.code COLLATE "C" = l.code COLLATE "C"
WHERE COALESCE(p.user_id, l.user_id) =
  (SELECT owner_user_id FROM public.swiftpilot_reader_scope WHERE singleton = true);

REVOKE ALL ON TABLE public.swiftpilot_programs_v1 FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'swiftpilot_reader') THEN
    CREATE ROLE swiftpilot_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB
      NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'swiftpilot_reader'
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'swiftpilot_reader exists with unsafe attributes';
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO swiftpilot_reader;
GRANT SELECT ON TABLE public.swiftpilot_programs_v1 TO swiftpilot_reader;

COMMIT;

-- Operator steps after applying the migration:
-- 1. Confirm the owner's UUID in auth.users, then bind the projection by running
--    INSERT INTO public.swiftpilot_reader_scope (singleton, owner_user_id)
--    VALUES (true, '<confirmed-owner-uuid>'::uuid)
--    ON CONFLICT (singleton) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id;
-- 2. In the Supabase dashboard, create a separate LOGIN role with a strong
--    password and no elevated privileges or other memberships. Then run
--    GRANT swiftpilot_reader TO <login_role>;
--    Do not put a password or connection string in this migration.
-- 3. Verify that login can SELECT only the expected owner rows from the view,
--    cannot read programs/notes directly, and cannot write. Audit inherited
--    PUBLIC privileges on existing objects before enabling the connection.

-- Rollback (after stopping UI edits and SwiftPilot reads): revoke the LOGIN
-- membership and SELECT grant, then DROP VIEW public.swiftpilot_programs_v1.
-- Keep public.programs and its owner data for recovery. A destructive rollback
-- requires a backup and a separate decision; it must not alter public.links.
