import { z } from "zod";
import { CONTACT_LEVELS, customerBaseSchema, fold } from "./customers";

// Form thông tin doanh nghiệp: a public link (/form/<token>) a company fills in; each answer
// waits in "Chờ duyệt" on the Khách hàng page until someone with "Quản lý khách hàng" adds it,
// merges it into a listed company, or turns it down. Shared by the API, the pages and the tests.

/** How long a new link takes answers, in days; 0 = until revoked. */
export const INTAKE_DAYS = [7, 30, 90, 0] as const;
export type IntakeDays = (typeof INTAKE_DAYS)[number];
export const intakeDaysLabel = (d: IntakeDays) => (d ? `${d} ngày` : "Không thời hạn");
/** The expiry stored for a link without one (the column is required): far enough to never come. */
export const INTAKE_NEVER = new Date("9999-12-31T00:00:00Z");
export const isNeverExpiring = (expiresAt: Date | string) => new Date(expiresAt).getUTCFullYear() >= 9999;
export const INTAKE_CONTACTS_MAX = 10;
/** Answers waiting for review per link: a leaked link cannot flood the queue (a permanent link keeps working once they are handled). */
export const INTAKE_SUBMISSIONS_MAX = 200;

export const intakePath = (token: string) => `/form/${token}`;

export const INTAKE_STATUS = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã thêm",
  MERGED: "Đã gộp",
  REJECTED: "Đã từ chối",
} as const;
export type IntakeStatus = keyof typeof INTAKE_STATUS;

const opt = (max: number) =>
  z
    .string()
    .max(max, `Tối đa ${max} ký tự`)
    .nullish()
    .transform((v) => (v == null ? null : v.trim() || null));

export const intakeContactSchema = z.object({
  level: z.enum(CONTACT_LEVELS),
  name: z.string().trim().min(1, "Nhập họ tên người liên hệ").max(120, "Tối đa 120 ký tự"),
  title: opt(120),
  department: opt(120),
  phone: opt(40),
  email: opt(200).refine((v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email người liên hệ chưa đúng định dạng"),
});

/** What the company sends: its own details and up to ten people. */
export const intakeSchema = customerBaseSchema.extend({
  contacts: z.array(intakeContactSchema).max(INTAKE_CONTACTS_MAX, `Tối đa ${INTAKE_CONTACTS_MAX} người liên hệ`).default([]),
  /** Honeypot: hidden from people, filled by bots. */
  website2: z.string().max(200).optional(),
});
export type IntakeData = Omit<z.output<typeof intakeSchema>, "website2">;
export type IntakeContact = z.output<typeof intakeContactSchema>;

export const createIntakeLinkSchema = z.object({
  label: z.string().trim().min(1, "Đặt tên cho link").max(120, "Tối đa 120 ký tự"),
  days: z.number().refine((d): d is IntakeDays => (INTAKE_DAYS as readonly number[]).includes(d), "Thời hạn không hợp lệ").default(30),
});

export const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("merge"), customerId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("reject") }),
]);

export type CheckLevel = "ok" | "warn" | "error";
export interface IntakeCheck {
  level: CheckLevel;
  field: string;
  message: string;
}

/** AI's verdict, stored on the answer once asked for. */
export interface IntakeAiReview {
  verdict: "ok" | "check" | "suspicious";
  summary: string;
  issues: { field: string; message: string }[];
  model: string;
  at: string;
}

const digits = (s: string) => s.replace(/[\s.-]/g, "");

/** Mã số thuế: 10 digits, or 10 + "-" + 3 for a branch. */
export const validTaxCode = (v: string) => /^\d{10}(-?\d{3})?$/.test(v.replace(/\s/g, ""));
/** A Vietnamese phone number: 0 or +84, then 9–10 digits. */
export const validPhone = (v: string) => /^(\+?84|0)\d{8,10}$/.test(digits(v).replace(/[()]/g, ""));

export interface ListedCustomer {
  id: string;
  name: string;
  taxCode: string | null;
}

/** The company's name without "Công ty TNHH…" and marks, to spot the same company spelled twice. */
export function companyKey(name: string): string {
  return fold(name)
    .replace(/\b(cong ty|cty|co phan|tnhh|trach nhiem huu han|mtv|mot thanh vien|tap doan|chi nhanh|jsc|co\.?,? ?ltd|ltd|company)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Listed companies this answer may already be: same tax code, or the same name once the "Công ty TNHH" is gone. */
export function possibleDuplicates(data: Pick<IntakeData, "name" | "taxCode">, listed: ListedCustomer[]): ListedCustomer[] {
  const tax = data.taxCode ? digits(data.taxCode) : null;
  const key = companyKey(data.name);
  return listed.filter((c) => (tax && c.taxCode && digits(c.taxCode) === tax) || (key && companyKey(c.name) === key));
}

/** Checks that need no AI: formats, missing essentials, companies already in the list. */
export function intakeChecks(data: IntakeData, listed: ListedCustomer[]): IntakeCheck[] {
  const out: IntakeCheck[] = [];
  if (!data.taxCode) out.push({ level: "warn", field: "taxCode", message: "Chưa có mã số thuế" });
  else if (!validTaxCode(data.taxCode)) out.push({ level: "error", field: "taxCode", message: "Mã số thuế phải có 10 số (chi nhánh: 10 số + 3 số)" });
  if (data.phone && !validPhone(data.phone)) out.push({ level: "warn", field: "phone", message: "Số điện thoại công ty không giống số Việt Nam" });
  if (!data.address) out.push({ level: "warn", field: "address", message: "Chưa có địa chỉ" });
  if (!data.contacts.length) out.push({ level: "warn", field: "contacts", message: "Chưa có người liên hệ" });
  data.contacts.forEach((c, i) => {
    if (!c.phone && !c.email) out.push({ level: "warn", field: `contacts.${i}`, message: `${c.name}: chưa có điện thoại hay email` });
    if (c.phone && !validPhone(c.phone)) out.push({ level: "warn", field: `contacts.${i}.phone`, message: `${c.name}: số điện thoại không giống số Việt Nam` });
  });
  for (const d of possibleDuplicates(data, listed)) out.push({ level: "warn", field: "name", message: `Có thể trùng “${d.name}” đã có trong danh sách` });
  return out;
}
