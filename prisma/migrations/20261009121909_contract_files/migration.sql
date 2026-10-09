-- CreateTable
CREATE TABLE "ContractFile" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractFileBlob" (
    "fileId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ContractFileBlob_pkey" PRIMARY KEY ("fileId")
);

-- CreateIndex
CREATE INDEX "ContractFile_contractId_idx" ON "ContractFile"("contractId");

-- AddForeignKey
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractFileBlob" ADD CONSTRAINT "ContractFileBlob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ContractFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PDFs are already compressed: store the bytes uncompressed out of line, so
-- lib/file-storage.ts can read a file in slices (substring) without decompressing it.
ALTER TABLE "ContractFileBlob" ALTER COLUMN "data" SET STORAGE EXTERNAL;
