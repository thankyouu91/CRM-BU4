import { NextResponse } from "next/server";
import { clearSession } from "@/lib/issue-session";
import { auth } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function POST() {
  const me = await auth();
  if (me) {
    await audit(
      { id: me.id, name: me.name },
      { action: "auth.logout", entityType: "session", entityId: me.id, summary: `${me.name} đăng xuất` },
    );
  }
  return clearSession(NextResponse.json({ ok: true }));
}
