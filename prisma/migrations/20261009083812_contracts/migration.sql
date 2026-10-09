-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'TESTING', 'COMPLETED');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'FINANCE_MANAGE';

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "partner" TEXT,
    "value" BIGINT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "trainingCost" BIGINT NOT NULL DEFAULT 0,
    "examCost" BIGINT NOT NULL DEFAULT 0,
    "otherCost" BIGINT NOT NULL DEFAULT 0,
    "expectedMargin" DOUBLE PRECISION,
    "collected" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_performedAt_idx" ON "Contract"("performedAt");

-- CreateIndex
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
