-- Least-privilege database role for the application (run after
-- supabase-hardening.sql). The app reads and writes rows; it cannot change the
-- schema, read Supabase's internal schemas, or bypass anything else.
--
-- The password is set separately, at deploy time, and goes straight into the
-- Hyperdrive configuration:
--   ALTER ROLE crm_app WITH LOGIN PASSWORD '<random>';

CREATE ROLE crm_app NOLOGIN;

GRANT USAGE ON SCHEMA public TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "User", "Project", "ProjectMember", "Category", "Task", "TaskReport", "Note", "Contract",
  "WorkReport", "ContractFile", "ContractFileBlob", "AppSetting"
  TO crm_app;

-- RLS is enabled on every table (supabase-hardening.sql). crm_app is not the
-- table owner, so it needs explicit policies; the Supabase API roles still have none.
CREATE POLICY crm_app_all ON "User"          FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "Project"       FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "ProjectMember" FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "Category"      FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "Task"          FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "TaskReport"    FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "Note"          FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "Contract"      FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "WorkReport"    FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "ContractFile"     FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "ContractFileBlob" FOR ALL TO crm_app USING (true) WITH CHECK (true);
CREATE POLICY crm_app_all ON "AppSetting"       FOR ALL TO crm_app USING (true) WITH CHECK (true);

-- Tables added by future migrations (run as postgres) are usable by the app;
-- each new table still needs ENABLE ROW LEVEL SECURITY + a crm_app policy.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;
