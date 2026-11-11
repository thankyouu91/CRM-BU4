import { NextResponse } from "next/server";
import { clearSession } from "@/lib/issue-session";
import { auth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export async function POST() {
  const me = await auth();
  if (me) {
    // Signing out ends the session itself, not only this browser's copy of it: a cookie
    // copied earlier stops working (and so do this person's other devices).
    await prisma.user.update({ where: { id: me.id }, data: { tokenVersion: { increment: 1 } } });
    await audit(
      { id: me.id, name: me.name },
      { action: "auth.logout", entityType: "session", entityId: me.id, summary: `${me.name} đăng xuất` },
    );
  }
  return clearSession(NextResponse.json({ ok: true }));
}
