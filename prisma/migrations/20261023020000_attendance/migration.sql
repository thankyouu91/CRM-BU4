-- CreateTable
CREATE TABLE "AttendanceMark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitlement" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "carriedOver" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("userId","year")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "AttendanceMark_day_idx" ON "AttendanceMark"("day");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMark_userId_day_session_key" ON "AttendanceMark"("userId", "day", "session");

-- AddForeignKey
ALTER TABLE "AttendanceMark" ADD CONSTRAINT "AttendanceMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMark" ADD CONSTRAINT "AttendanceMark_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase: keep the Data API roles out (as prisma/supabase-hardening.sql does for
-- every table) and let the app role in (prisma/supabase-app-role.sql), when it exists.
ALTER TABLE "AttendanceMark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') THEN
    CREATE POLICY crm_app_all ON "AttendanceMark" FOR ALL TO crm_app USING (true) WITH CHECK (true);
    CREATE POLICY crm_app_all ON "LeaveBalance" FOR ALL TO crm_app USING (true) WITH CHECK (true);
    CREATE POLICY crm_app_all ON "Holiday" FOR ALL TO crm_app USING (true) WITH CHECK (true);
    GRANT SELECT, INSERT, UPDATE, DELETE ON "AttendanceMark", "LeaveBalance", "Holiday" TO crm_app;
  END IF;
END $$;
