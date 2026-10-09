import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, forbidden, notFound, ok, unauthorized } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { contentDisposition } from "@/lib/contract-files";
import { deleteFiles, getFile } from "@/lib/file-storage";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

const findFile = (p: { id: string; fileId: string }) =>
  prisma.contractFile.findFirst({ where: { id: p.fileId, contractId: p.id }, select: { id: true, name: true } });

/** GET /api/contracts/[id]/files/[fileId]: the PDF, shown inline (?download=1 saves it). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");
  const file = await findFile(params);
  if (!file) return notFound("Không tìm thấy file hợp đồng");
  const stored = await getFile(file.id);
  if (!stored) return notFound("Nội dung file không còn trong kho lưu trữ");
  return new Response(stored.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(stored.size),
      "Content-Disposition": contentDisposition(file.name, req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"),
      "X-Content-Type-Options": "nosniff",
      // Files never change under an id; only this browser may keep a copy.
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const params = await ctx.params;
  const me = await auth();
  if (!me) return unauthorized();
  if (!hasPermission(me, "FINANCE_MANAGE")) return forbidden("Bạn chưa được cấp quyền “Hợp đồng & chi phí”");
  const file = await findFile(params);
  if (!file) return notFound("Không tìm thấy file hợp đồng");
  await prisma.contractFile.delete({ where: { id: file.id } });
  await deleteFiles([file.id]);
  return ok({ ok: true });
}
