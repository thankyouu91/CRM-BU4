import { describe, expect, it } from "vitest";
import { companyKey, intakeChecks, intakeSchema, possibleDuplicates, validPhone, validTaxCode } from "@/lib/customer-intake";

const base = intakeSchema.parse({ name: "Công ty TNHH Đông Á", taxCode: "0312345678", address: "Q1", contacts: [{ level: "DIRECTOR", name: "An", phone: "0901 234 567" }] });

describe("customer form rules", () => {
  it("knows tax codes and Vietnamese phone numbers", () => {
    expect(["0312345678", "0312345678-001", "0312345678001"].every(validTaxCode)).toBe(true);
    expect(["031234567", "abc", "0312345678-01"].some(validTaxCode)).toBe(false);
    expect(["0901234567", "+84 901 234 567", "028.3822.1234"].every(validPhone)).toBe(true);
    expect(validPhone("12345")).toBe(false);
  });

  it("sees the same company behind another legal form, or the same tax code", () => {
    expect(companyKey("Công ty Cổ phần Đông Á")).toBe(companyKey("CTY TNHH ĐÔNG Á"));
    const listed = [
      { id: "1", name: "Đông Á JSC", taxCode: null },
      { id: "2", name: "Khác", taxCode: "0312 345 678" },
      { id: "3", name: "Đông Á Xanh", taxCode: null },
    ];
    expect(possibleDuplicates(base, listed).map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("passes a complete answer and flags what is missing or wrong", () => {
    expect(intakeChecks(base, [])).toEqual([]);
    const poor = intakeSchema.parse({ name: "X", taxCode: "123", contacts: [{ level: "STAFF", name: "B" }] });
    expect(intakeChecks(poor, []).map((c) => [c.level, c.field])).toEqual([
      ["error", "taxCode"],
      ["warn", "address"],
      ["warn", "contacts.0"],
    ]);
  });

  it("refuses unknown positions and too many people", () => {
    expect(intakeSchema.safeParse({ name: "X", contacts: [{ level: "BOSS", name: "B" }] }).success).toBe(false);
    expect(intakeSchema.safeParse({ name: "X", contacts: Array.from({ length: 11 }, () => ({ level: "STAFF", name: "B" })) }).success).toBe(false);
  });
});
