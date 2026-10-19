-- CreateTable
CREATE TABLE "DeckShare" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" TEXT,
    "from" TEXT,
    "to" TEXT,
    "projectId" TEXT,
    "label" TEXT,
    "includeFinance" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeckShare_tokenHash_key" ON "DeckShare"("tokenHash");

-- CreateIndex
CREATE INDEX "DeckShare_createdById_createdAt_idx" ON "DeckShare"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "DeckShare" ADD CONSTRAINT "DeckShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckShare" ADD CONSTRAINT "DeckShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase: keep the Data API roles out (as prisma/supabase-hardening.sql does for
-- every table) and let the app role in (prisma/supabase-app-role.sql), when it exists.
ALTER TABLE "DeckShare" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') THEN
    CREATE POLICY crm_app_all ON "DeckShare" FOR ALL TO crm_app USING (true) WITH CHECK (true);
    GRANT SELECT, INSERT, UPDATE, DELETE ON "DeckShare" TO crm_app;
  END IF;
END $$;
