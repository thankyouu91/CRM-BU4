import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser, type CurrentUser } from "./session";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function unauthorized(message = "Chưa đăng nhập") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Bạn không có quyền thực hiện thao tác này") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Không tìm thấy") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Lỗi máy chủ") {
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Resolve the authenticated user or null (for use at the top of handlers). */
export async function auth(): Promise<CurrentUser | null> {
  return getCurrentUser();
}

/** Turn a ZodError into a flat field->message map for the client. */
export function zodErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Wrap a handler with consistent error handling. */
export async function handle<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", fields: zodErrors(err) },
        { status: 400 },
      );
    }
    console.error("[API]", err);
    return serverError();
  }
}
