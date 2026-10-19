import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { canSeeAllShares, canShareReports, hashShareToken, isShareToken, newShareToken, shareExpiry, sharePath, shareStatus } from "../lib/report-share-rules";

describe("public presentation links", () => {
  it("makes long random tokens and stores only their SHA-256", async () => {
    const tokens = new Set(Array.from({ length: 50 }, newShareToken));
    expect(tokens.size).toBe(50);
    for (const t of tokens) expect(isShareToken(t)).toBe(true);
    const token = [...tokens][0];
    expect(await hashShareToken(token)).toBe(createHash("sha256").update(token).digest("hex"));
    expect(sharePath(token)).toBe(`/share/${token}`);
    // Anything else is refused before the database is asked.
    for (const bad of ["", "abc", `${token}x`, `${token.slice(0, 42)}/`, null, undefined]) expect(isShareToken(bad)).toBe(false);
  });

  it("works until it expires or is revoked", () => {
    const now = new Date("2026-10-19T03:00:00Z");
    expect(shareExpiry(7, now).toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(shareStatus({ expiresAt: shareExpiry(1, now), revokedAt: null }, now)).toBe("active");
    expect(shareStatus({ expiresAt: now, revokedAt: null }, now)).toBe("expired");
    expect(shareStatus({ expiresAt: shareExpiry(30, now), revokedAt: now }, now)).toBe("revoked");
  });

  it("is created by team leads and above; administrators see every link", () => {
    expect(["ADMIN", "MANAGER", "LEAD", "MEMBER"].map((role) => canShareReports({ role }))).toEqual([true, true, true, false]);
    expect(["ADMIN", "MANAGER"].map((role) => canSeeAllShares({ role }))).toEqual([true, false]);
  });
});
