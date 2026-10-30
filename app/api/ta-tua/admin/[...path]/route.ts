import type { NextRequest } from "next/server";
import { auth, forbidden, handle, unauthorized } from "@/lib/api";
import { audit } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit-actions";
import { gameFetch } from "@/lib/petdex";
import { isAdmin } from "@/lib/rbac";

// Pet Town management board: administrators only. Requests are relayed to the game server's
// internal admin API (petdex/server/internal.js); every change is also written to WorkHub's
// audit log with the administrator as actor.

const ALLOWED = /^(overview|log|announcements(\/\d+\/delete)?|gear-config|gear\/\d+(\/delete)?|gift-codes(\/\d+(\/revoke)?)?|industries\/(status|unmerge|merge|heavy)|commerce|arena(\/\d+\/cancel)?|bots(\/config)?|chat(\/\d+\/delete)?|mail|clans(\/(config|macro|plots\/\d+|evasion\/\d+\/(collect|dismiss)))?|invites(\/\d+\/revoke)?|players(\/\d+(\/(coins|status|name|password-link|gear|mute|pets(\/\d+)?))?)?)$/;

/** Body fields that only label the audit entry; the game never sees them. */
const LABEL_FIELDS = ["challenger", "defender", "targetName", "announcementTitle", "playerName", "petName", "speciesName", "itemName", "tierName", "clanName", "plotCode", "author"];

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
  if (path === "bots/config") {
    if (body.enabled === false) return { action: "tatua.bots_config", entityId: null, summary: "Tắt toàn bộ cư dân tự động (bot)" };
    return { action: "tatua.bots_config", entityId: null, summary: `Bật cư dân tự động, mục tiêu ${Number(body.target ?? 0).toLocaleString("vi-VN")} bot, online ${Number(body.onlineMin ?? 0)}–${Number(body.onlineMax ?? 0)}` };
  }
  if (/^arena\/\d+\/cancel$/.test(path)) {
    const fight = body.challenger && body.defender ? ` ${String(body.challenger)} ⚔️ ${String(body.defender)}` : "";
    return { action: "tatua.arena_cancel", entityId: id, summary: `Hủy trận Đấu trường #${id}${fight}${body.targetName ? ` (${String(body.targetName)})` : ""}${body.reason ? `: ${String(body.reason)}` : ""}` };
  }
  if (path === "industries/unmerge") return { action: "tatua.industry_unmerge", entityId: null, summary: "Gỡ gộp ngành gia tộc (26 → 41 ngành) để quay lại bản cũ" };
  if (path === "industries/heavy") return { action: body.open ? "tatua.heavy_open" : "tatua.heavy_close", entityId: null, summary: body.open ? "Mở lại công nghiệp nặng" : "Tạm đóng công nghiệp nặng (hoàn phí thâu tóm cho gia tộc đang nắm)" };
  if (path === "industries/merge") return { action: "tatua.industry_merge", entityId: null, summary: "Gộp lại các ngành gia tộc (41 → 26 ngành)" };
  if (path === "mail") {
    const to = body.to === "all" ? "mọi người chơi" : typeof body.playerName === "string" ? `“${body.playerName}”` : `người chơi #${String(body.to)}`;
    const gift = Number(body.coins) > 0 ? ` kèm ${Number(body.coins).toLocaleString("vi-VN")} xu` : "";
    return { action: "tatua.mail", entityId: body.to === "all" ? null : String(body.to), summary: `Gửi thư “${String(body.subject ?? "")}” cho ${to}${gift}` };
  }
  if (/^chat\/\d+\/delete$/.test(path)) return { action: "tatua.chat_delete", entityId: id, summary: `Xoá tin nhắn #${id}${body.author ? ` của “${String(body.author)}”` : ""}` };
  if (/^players\/\d+\/mute$/.test(path)) {
    const hours = Number(body.hours) || 0;
    return { action: hours ? "tatua.chat_mute" : "tatua.chat_unmute", entityId: id, summary: hours ? `Cấm chat ${player} ${hours} giờ` : `Bỏ cấm chat ${player}` };
  }
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
