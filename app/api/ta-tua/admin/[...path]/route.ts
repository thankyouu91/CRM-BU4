import type { NextRequest } from "next/server";
import { auth, forbidden, handle, unauthorized } from "@/lib/api";
import { audit } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit-actions";
import { gameFetch } from "@/lib/petdex";
import { isAdmin } from "@/lib/rbac";

// Pet Town management board: administrators only. Requests are relayed to the game server's
// internal admin API (petdex/server/internal.js); every change is also written to WorkHub's
// audit log with the administrator as actor.

const ALLOWED = /^(overview|log|announcements(\/\d+\/delete)?|gear-config|gear\/\d+(\/delete)?|gift-codes(\/\d+(\/revoke)?)?|clans(\/(config|macro|plots\/\d+|evasion\/\d+\/(collect|dismiss)))?|invites(\/\d+\/revoke)?|players(\/\d+(\/(coins|status|name|password-link|gear|pets(\/\d+)?))?)?)$/;

/** Body fields that only label the audit entry; the game never sees them. */
const LABEL_FIELDS = ["announcementTitle", "playerName", "petName", "speciesName", "itemName", "tierName", "clanName", "plotCode"];

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
  // the one-time code is only in the response, never in the audit entry
  if (/^players\/\d+\/password-link$/.test(path)) return { action: "tatua.password_link", entityId: id, summary: `Tạo link đặt mật khẩu cho ${player} (dùng một lần, 24 giờ)` };
  if (/^players\/\d+\/gear$/.test(path)) return { action: "tatua.gear_grant", entityId: id, summary: `Tặng trang phục ${String(body.itemName ?? "ngẫu nhiên")} (${String(body.tierName ?? "cấp ngẫu nhiên")}) cho ${player}` };
  if (/^gear\/\d+$/.test(path)) return { action: "tatua.gear_edit", entityId: id, summary: `Sửa cấp và chỉ số trang phục #${id}${body.itemName ? ` “${String(body.itemName)}”` : ""}${body.playerName ? ` của ${player}` : ""}` };
  if (/^gear\/\d+\/delete$/.test(path)) return { action: "tatua.gear_delete", entityId: id, summary: `Xoá trang phục #${id}${body.itemName ? ` “${String(body.itemName)}”` : ""}${body.playerName ? ` của ${player}` : ""}` };
  if (path === "gear-config") return { action: "tatua.gear_config", entityId: null, summary: "Chỉnh tỷ lệ cấp, biên độ chỉ số trang phục và tỷ lệ rớt đồ mini-game" };
  if (path === "gift-codes") {
    const n = Number(body.count) > 1 ? Number(body.count) : 1;
    return { action: "tatua.gift_code", entityId: null, summary: `Tạo ${n > 1 ? `${n} mã quà` : "mã quà"} “${String(body.label || "Mã quà")}”` };
  }
  if (/^gift-codes\/\d+\/revoke$/.test(path)) return { action: "tatua.gift_code_revoke", entityId: id, summary: `Thu hồi mã quà #${id}` };
  if (path === "clans/config") return { action: "tatua.clan_config", entityId: null, summary: "Chỉnh luật gia tộc, thuế doanh nghiệp và giá đất" };
  if (/^clans\/plots\/\d+$/.test(path)) {
    const plot = body.plotCode ? `lô ${String(body.plotCode)}` : `lô #${path.split("/")[2]}`;
    return { action: "tatua.land_price", entityId: path.split("/")[2], summary: body.price ? `Đặt giá ${plot}: ${Number(body.price).toLocaleString("vi-VN")} xu` : `Trả ${plot} về giá tự tính` };
  }
  if (path === "clans/macro") return { action: "tatua.macro", entityId: null, summary: `Chỉnh kinh tế vĩ mô: pha ${String(body.phase ?? "tự động")}, thời tiết ${String(body.weather ?? "tự động")}${body.today ? " (áp dụng ngay)" : ""}` };
  if (/^clans\/evasion\/\d+\/collect$/.test(path)) return { action: "tatua.tax_collect", entityId: path.split("/")[2], summary: `Truy thu thuế trốn của gia tộc${body.clanName ? ` “${String(body.clanName)}”` : ""} (hồ sơ #${path.split("/")[2]})` };
  if (/^clans\/evasion\/\d+\/dismiss$/.test(path)) return { action: "tatua.tax_dismiss", entityId: path.split("/")[2], summary: `Bỏ qua hồ sơ thuế #${path.split("/")[2]}${body.clanName ? ` của “${String(body.clanName)}”` : ""}` };
  if (path === "announcements") return { action: "tatua.announcement", entityId: null, summary: `Đăng thông báo “${String(body.title ?? "")}” (${Number(body.days) || 7} ngày${body.popup === false ? ", không bật lên" : ""})` };
  if (/^announcements\/\d+\/delete$/.test(path)) return { action: "tatua.announcement_delete", entityId: id, summary: `Gỡ thông báo #${id}${body.announcementTitle ? ` “${String(body.announcementTitle)}”` : ""}` };
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
    // Label fields only describe the audit entry; the game gets the rest.
    const payload = Object.fromEntries(Object.entries(body).filter(([key]) => !LABEL_FIELDS.includes(key)));
    const res = await relay(req, path, { ...payload, actor: me.name });
    if (res.ok) {
      const entry = describe(path, body);
      if (entry) await audit(me, { ...entry, entityType: "tatua", details: payload });
    }
    return res;
  });
}
