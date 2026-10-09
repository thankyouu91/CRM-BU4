import { prisma } from "./prisma";
import { putFile } from "./file-storage";
import { InputError } from "./errors";
import { contractFileDto, contractFileSelect, formatFileSize, MAX_FILES_PER_CONTRACT, STORAGE_LIMIT_BYTES } from "./contract-files";

/** Metadata reserves quota before writing bytes. Every upload shares the transaction-scoped lock. */
export async function storeContractFiles(contractId: string, uploadedById: string, items: { name: string; bytes: Uint8Array }[]) {
  const reserved = await prisma.$transaction(async (tx) => {
    // SELECT an integer instead of PostgreSQL's void return type (unsupported by Prisma).
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(742004)`;
    const count = await tx.contractFile.count({ where: { contractId } });
    const used = (await tx.contractFile.aggregate({ _sum: { size: true } }))._sum.size ?? 0;
    if (count + items.length > MAX_FILES_PER_CONTRACT) {
      throw new InputError(`Mỗi hợp đồng lưu tối đa ${MAX_FILES_PER_CONTRACT} file PDF (hiện đã có ${count} file).`);
    }
    const adding = items.reduce((sum, item) => sum + item.bytes.length, 0);
    if (used + adding > STORAGE_LIMIT_BYTES) {
      throw new InputError(`Kho lưu trữ đã dùng ${formatFileSize(used)} / ${formatFileSize(STORAGE_LIMIT_BYTES)}, không đủ chỗ cho ${formatFileSize(adding)}.`);
    }
    const files = [];
    for (const item of items) {
      files.push(await tx.contractFile.create({
        data: { contractId, uploadedById, name: item.name, size: item.bytes.length, mimeType: "application/pdf" },
        select: contractFileSelect,
      }));
    }
    return files;
  }, { isolationLevel: "ReadCommitted", maxWait: 10_000, timeout: 15_000 });

  try {
    for (let i = 0; i < items.length; i++) await putFile(reserved[i].id, items[i].bytes);
  } catch (error) {
    // Cascade also removes any blobs already stored by this batch.
    await prisma.contractFile.deleteMany({ where: { id: { in: reserved.map((f) => f.id) } } });
    throw error;
  }
  return reserved.map(contractFileDto);
}
