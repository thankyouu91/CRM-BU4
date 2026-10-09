-- Run once on a Supabase database, after `prisma migrate deploy`
-- (Supabase dashboard → SQL Editor, or `psql "$DATABASE_URL" -f prisma/supabase-hardening.sql`).
--
-- Why: Supabase automatically exposes the `public` schema through its Data API
-- (PostgREST) to the `anon` and `authenticated` roles, using a key that is
-- public by design. This app never uses that API — it connects to Postgres
-- directly as the table owner — so the API roles are locked out completely.
-- Row Level Security with no policies denies them every row; the owner
-- connection used by the app bypasses RLS and is unaffected.

ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskReport"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Note"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract"      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Tables created later by migrations (run as `postgres`) are not granted to
-- the API roles either. New tables should still get ENABLE ROW LEVEL SECURITY.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
