import { NextResponse } from "next/server";
import { clearSession } from "@/lib/issue-session";

export async function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}
