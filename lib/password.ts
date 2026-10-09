import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Password policy. Returns a Vietnamese error message, or null when valid. */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự.";
  if (pw.length > 128) return "Mật khẩu quá dài (tối đa 128 ký tự).";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return "Mật khẩu phải có cả chữ hoa và chữ thường.";
  if (!/[0-9]/.test(pw)) return "Mật khẩu phải chứa ít nhất một chữ số.";
  return null;
}
