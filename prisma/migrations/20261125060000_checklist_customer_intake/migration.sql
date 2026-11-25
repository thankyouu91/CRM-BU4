-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "kind" TEXT;

-- CreateTable
CREATE TABLE "CustomerIntakeLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerIntakeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSubmission" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "aiReview" JSONB,
    "customerId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdDay" TEXT NOT NULL,
    "doneDay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerIntakeLink_tokenHash_key" ON "CustomerIntakeLink"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerSubmission_status_createdAt_idx" ON "CustomerSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ChecklistItem_userId_createdDay_idx" ON "ChecklistItem"("userId", "createdDay");

-- AddForeignKey
ALTER TABLE "CustomerIntakeLink" ADD CONSTRAINT "CustomerIntakeLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSubmission" ADD CONSTRAINT "CustomerSubmission_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "CustomerIntakeLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSubmission" ADD CONSTRAINT "CustomerSubmission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSubmission" ADD CONSTRAINT "CustomerSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same protection as every other table (Supabase: only the app role reaches them).
ALTER TABLE "CustomerIntakeLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app') THEN
    CREATE POLICY crm_app_all ON "CustomerIntakeLink" FOR ALL TO crm_app USING (true) WITH CHECK (true);
    CREATE POLICY crm_app_all ON "CustomerSubmission" FOR ALL TO crm_app USING (true) WITH CHECK (true);
    CREATE POLICY crm_app_all ON "ChecklistItem" FOR ALL TO crm_app USING (true) WITH CHECK (true);
    GRANT SELECT, INSERT, UPDATE, DELETE ON "CustomerIntakeLink", "CustomerSubmission", "ChecklistItem" TO crm_app;
  END IF;
END $$;
