import type { NextRequest } from "next/server";
import { auth, forbidden, handle, unauthorized } from "@/lib/api";
import { audit } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit-actions";
import { gameFetch } from "@/lib/petdex";
import { isAdmin } from "@/lib/rbac";

// Pet Town management board: administrators only. Requests are relayed to the game server's
// internal admin API (petdex/server/internal.js); every change is also written to WorkHub's
// audit log with the administrator as actor.

const ALLOWED = /^(overview|log|invites(\/\d+\/revoke)?|players(\/\d+(\/(coins|status|name|pets(\/\d+)?))?)?)$/;

type Params = { params: Promise<{ path: string[] }> };

async function relay(req: NextRequest, path: string, body?: unknown) {
  const res = await gameFetch(`/internal/admin/${path}${req.nextUrl.search}`, body === undefined ? {} : { method: "POST", body });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function describe(path: string, body: Record<string, unknown>): { action: AuditAction; summary: string; entityId: string | null } | null {
  const player = typeof body.playerName === "string" ? `“${body.playerName}”` : `người chơi #${path.split("/")[1]}`;
  const id = path.split("/")[1] ?? null;
  if (/^players\/\d+\/coins$/.test(path)) {
    const delta = Number(body.delta);
    return { action: "tatua.coins", entityId: id, summary: `${delta >= 0 ? "Cộng" : "Trừ"} ${Math.abs(delta).toLocaleString("vi-VN")} xu ${delta >= 0 ? "cho" : "của"} ${player}${body.memo ? `: ${body.memo}` : ""}` };
  }
  if (/^players\/\d+\/pets$/.test(path)) return { action: "tatua.pet_grant", entityId: id, summary: `Tặng thú cưng ${body.speciesName ? `“${String(body.speciesName)}” ` : ""}cho ${player}` };
  if (/^players\/\d+\/pets\/\d+$/.test(path)) return { action: "tatua.pet", entityId: id, summary: `Sửa chỉ số thú cưng ${body.petName ? `“${body.petName}” ` : ""}của ${player}` };
  if (/^players\/\d+\/status$/.test(path)) return { action: body.banned ? "tatua.ban" : "tatua.unban", entityId: id, summary: `${body.banned ? "Khoá" : "Mở khoá"} ${player}` };
  if (/^players\/\d+\/name$/.test(path)) return { action: "tatua.rename", entityId: id, summary: `Đổi tên ${player} thành “${String(body.displayName ?? "")}”` };
  if (path === "invites") return { action: "tatua.invite", entityId: null, summary: `Tạo link mời khách “${String(body.label ?? "Khách mời")}”` };
  if (/^invites\/\d+\/revoke$/.test(path)) return { action: "tatua.invite_revoke", entityId: path.split("/")[1], summary: `Thu hồi link mời #${path.split("/")[1]}` };
  return null;
}

export async function GET(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới vào được bảng quản lý Pet Town");
    const path = (await params).path.join("/");
    if (!ALLOWED.test(path)) return forbidden("Đường dẫn không hợp lệ");
    return relay(req, path);
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const me = await auth();
    if (!me) return unauthorized();
    if (!isAdmin(me)) return forbidden("Chỉ quản trị viên mới vào được bảng quản lý Pet Town");
    const path = (await params).path.join("/");
    if (!ALLOWED.test(path)) return forbidden("Đường dẫn không hợp lệ");
    const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    // playerName / petName / speciesName only label the audit entry; the game gets the rest.
    const payload = Object.fromEntries(Object.entries(body).filter(([key]) => !["playerName", "petName", "speciesName"].includes(key)));
    const res = await relay(req, path, { ...payload, actor: me.name });
    if (res.ok) {
      const entry = describe(path, body);
      if (entry) await audit(me, { ...entry, entityType: "tatua", details: payload });
    }
    return res;
  });
}
