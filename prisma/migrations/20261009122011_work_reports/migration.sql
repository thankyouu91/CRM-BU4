-- CreateEnum
CREATE TYPE "WorkReportPeriod" AS ENUM ('WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "WorkReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "WorkReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" "WorkReportPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "doneNote" TEXT,
    "doingNote" TEXT,
    "planNote" TEXT,
    "issues" TEXT,
    "status" "WorkReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "snapshot" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkReport_period_periodStart_idx" ON "WorkReport"("period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "WorkReport_userId_period_periodStart_key" ON "WorkReport"("userId", "period", "periodStart");

-- AddForeignKey
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
