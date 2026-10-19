// Public links to the report presentation (/share/<token>): the rules, no database.
// Shared by the API, the public page, the share dialog and the tests.

/** How long a new link stays valid, in days. */
export const SHARE_DAYS = [1, 7, 30, 90] as const;
export type ShareDays = (typeof SHARE_DAYS)[number];
export const DEFAULT_SHARE_DAYS: ShareDays = 7;

/** Links kept in the list (and in the database) this long after they stop working. */
export const SHARE_RETENTION_DAYS = 90;

/** 32 random bytes as base64url: 43 characters, not guessable. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const isShareToken = (value: string | null | undefined): value is string => !!value && TOKEN_SHAPE.test(value);

/** Only this hash is stored, so the database (or a backup) never holds a working link. */
export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const sharePath = (token: string) => `/share/${token}`;

export type ShareStatus = "active" | "expired" | "revoked";

export function shareStatus(share: { expiresAt: Date | string; revokedAt: Date | string | null }, now = new Date()): ShareStatus {
  if (share.revokedAt) return "revoked";
  return new Date(share.expiresAt).getTime() <= now.getTime() ? "expired" : "active";
}

export const SHARE_STATUS_LABEL: Record<ShareStatus, string> = { active: "Đang mở", expired: "Đã hết hạn", revoked: "Đã thu hồi" };

/**
 * Who may put a report in front of people outside the company: team leads and above.
 * Members can still copy the internal link, which needs a login.
 */
export const canShareReports = (user: { role: string }) => user.role !== "MEMBER";

/** Every link can be seen and revoked by its creator; administrators see all of them. */
export const canSeeAllShares = (user: { role: string }) => user.role === "ADMIN";

export function shareExpiry(days: ShareDays, now = new Date()): Date {
  return new Date(now.getTime() + days * 86_400_000);
}
