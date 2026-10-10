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
ALTER TABLE "WorkReport"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractFile"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractFileBlob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetting"       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Tables created later by migrations (run as `postgres`) are not granted to
-- the API roles either. New tables should still get ENABLE ROW LEVEL SECURITY.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Audit log is append-only for the app: it may read, add, and (daily job) delete
-- expired entries, but never edit one. When the app connects as a dedicated role
-- (crm_app) rather than the owner, give that role exactly these rights:
--   CREATE POLICY crm_app_all ON "AuditLog" TO crm_app USING (true) WITH CHECK (true);
--   REVOKE ALL ON "AuditLog" FROM crm_app;
--   GRANT SELECT, INSERT, DELETE ON "AuditLog" TO crm_app;
