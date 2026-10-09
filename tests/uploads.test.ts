import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({
  contract: { findUnique: vi.fn() },
  contractFile: { count: vi.fn(), aggregate: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../lib/session", () => ({ getCurrentUser: async () => ({ id: "u", role: "ADMIN", permissions: [] }) }));
const { putFile, storesInR2, deleteFiles } = vi.hoisted(() => ({ putFile: vi.fn(), storesInR2: vi.fn(), deleteFiles: vi.fn() }));
vi.mock("../lib/file-storage", () => ({ putFile, storesInR2, deleteFiles }));
vi.mock("../lib/audit", () => ({ audit: vi.fn() }));
import { POST } from "../app/api/contracts/[id]/files/route";
import { STORAGE_LIMIT_BYTES } from "../lib/contract-files";
import { storeContractFiles } from "../lib/contract-file-service";

let count: number;
let used: number;
beforeEach(() => {
  vi.clearAllMocks(); count = 19; used = 0;
  storesInR2.mockReturnValue(false);
  deleteFiles.mockResolvedValue(undefined);
  db.contract.findUnique.mockResolvedValue({ id: "c" });
  db.contractFile.count.mockImplementation(async () => count);
  db.contractFile.aggregate.mockImplementation(async () => ({ _sum: { size: used } }));
  db.contractFile.create.mockImplementation(async ({ data }) => {
    count++; used += data.size;
    return { ...data, id: `f${count}`, createdAt: new Date(), uploadedBy: { id: "u", name: "User" } };
  });
  db.contractFile.deleteMany.mockResolvedValue({ count: 1 });
  putFile.mockResolvedValue(undefined);
  // External database substitute: transactions serialize only when the code acquires its lock.
  let tail = Promise.resolve();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => {
    let release: (() => void) | undefined;
    const tx = { ...db, $queryRaw: vi.fn(async () => {
      const previous = tail;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      return [];
    }) };
    try { return await fn(tx); } finally { release?.(); }
  });
});

it("uses the R2 storage allowance instead of the smaller database allowance", async () => {
  storesInR2.mockReturnValue(true);
  count = 0; used = STORAGE_LIMIT_BYTES + 1;
  expect((await upload()).status).toBe(201);
});

it("cleans up the entire reserved batch when one blob fails", async () => {
  count = 0;
  putFile.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Storage unavailable"));
  const item = { name: "file.pdf", bytes: new TextEncoder().encode("%PDF-1.4\nhello") };
  await expect(storeContractFiles("c", "u", [item, item])).rejects.toThrow("Storage unavailable");
  expect(deleteFiles).toHaveBeenCalledWith(["f1", "f2"]);
  expect(db.contractFile.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["f1", "f2"] } } });
});
function upload() {
  const form = new FormData();
  form.append("files", new File(["%PDF-1.4\nhello"], "contract.pdf", { type: "application/pdf" }));
  return POST(new NextRequest("http://localhost/api/contracts/c/files", { method: "POST", body: form }), { params: Promise.resolve({ id: "c" }) });
}
it("allows only one concurrent upload when the contract has one remaining slot", async () => {
  const responses = await Promise.all([upload(), upload()]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 400]);
  expect(count).toBe(20);
});
it("reserves global storage before another upload checks its capacity", async () => {
  count = 0; used = STORAGE_LIMIT_BYTES - 14;
  const responses = await Promise.all([upload(), upload()]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 400]);
  expect(used).toBeLessThanOrEqual(STORAGE_LIMIT_BYTES);
});
