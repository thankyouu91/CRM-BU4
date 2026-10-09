import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, badRequest, created, forbidden, handle, notFound, ok, payloadTooLarge, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import {
  MAX_FILE_BYTES,
  MAX_UPLOAD_BYTES,
  STORAGE_LIMIT_BYTES,
  cleanFileName,
  contractFileDto,
  contractFileSelect,
  formatFileSize,
  isPdf,
} from "@/lib/contract-files";
import { storeContractFiles } from "@/lib/contract-file-service";

type Ctx = { params: Promise<{ id: string }> };

const storageUsed = async () => (await prisma.contractFile.aggregate({ _sum: { size: true } }))._sum.size ?? 0;

/** GET /api/contracts/[id]/files: the contract's PDFs (metadata only) and how much of the storage is used. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");
  const [contract, used] = await Promise.all([
    prisma.contract.findUnique({
      where: { id: params.id },
      select: { id: true, files: { orderBy: { createdAt: "asc" }, select: contractFileSelect } },
    }),
    storageUsed(),
  ]);
  if (!contract) return notFound("Không tìm thấy hợp đồng");
  return ok({ files: contract.files.map(contractFileDto), storage: { used, limit: STORAGE_LIMIT_BYTES } });
}

/** POST /api/contracts/[id]/files (multipart/form-data, one or more "files"): attach PDFs. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");
    if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) {
      return payloadTooLarge(`Mỗi lần tải lên tối đa ${formatFileSize(MAX_UPLOAD_BYTES)}. Hãy tải từng file một.`);
    }
    const contract = await prisma.contract.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!contract) return notFound("Không tìm thấy hợp đồng");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return badRequest("Không đọc được dữ liệu tải lên. Hãy chọn lại file PDF.");
    }
    const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
    if (!files.length) return badRequest("Chưa chọn file PDF nào");
    // Check every file before storing any.
    const items: { name: string; bytes: Uint8Array }[] = [];
    for (const f of files) {
      const name = cleanFileName(f.name);
      if (f.size === 0) return badRequest(`“${name}” là file rỗng.`);
      if (f.size > MAX_FILE_BYTES) {
        return badRequest(`“${name}” có dung lượng ${formatFileSize(f.size)}, vượt mức tối đa ${formatFileSize(MAX_FILE_BYTES)} mỗi file. Hãy nén hoặc tách file PDF.`);
      }
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!isPdf(bytes)) return badRequest(`“${name}” không phải file PDF. Chỉ lưu được hợp đồng dạng PDF.`);
      items.push({ name, bytes });
    }
    const adding = items.reduce((s, it) => s + it.bytes.length, 0);
    if (adding > MAX_UPLOAD_BYTES) return payloadTooLarge(`Mỗi lần tải lên tối đa ${formatFileSize(MAX_UPLOAD_BYTES)}.`);
    const saved = await storeContractFiles(contract.id, me.id, items);
    return created({ files: saved });
  });
}
