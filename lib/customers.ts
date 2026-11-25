import { z } from "zod";

// Khách hàng: shared by the API, the page and the tests (no server-only imports).
// A customer is a company; its people are listed by position, from the top down.

export const CONTACT_LEVELS = ["DIRECTOR", "DEPUTY", "HEAD", "STAFF"] as const;
export type ContactLevel = (typeof CONTACT_LEVELS)[number];

export const CONTACT_LEVEL_INFO: Record<ContactLevel, { label: string; titleHint: string }> = {
  DIRECTOR: { label: "Giám đốc", titleHint: "VD: Tổng giám đốc, Giám đốc điều hành" },
  DEPUTY: { label: "Phó giám đốc", titleHint: "VD: Phó tổng giám đốc, Phó giám đốc kinh doanh" },
  HEAD: { label: "Trưởng phòng", titleHint: "VD: Trưởng phòng nhân sự" },
  STAFF: { label: "Nhân viên", titleHint: "VD: Chuyên viên tuyển dụng" },
};

export interface CustomerContactDto {
  id: string;
  level: ContactLevel;
  name: string;
  title: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  note: string | null;
}

export interface CustomerDto {
  id: string;
  name: string;
  taxCode: string | null;
  industry: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  note: string | null;
  updatedAt: string;
  contacts: CustomerContactDto[];
  /** The customer's projects the viewer can see. */
  projects: CustomerProjectDto[];
  /** Loại khách hàng shown: the manual choice if set, else worked out from projects and contracts. */
  kind: CustomerKind;
  /** What the projects and contracts say, whatever was chosen by hand. */
  kindAuto: CustomerKind;
  kindManual: boolean;
  /** Size by the total value of the company's contracts; null before any contract. */
  size: CustomerSize | null;
  /** That total in VND, only for people with "Hợp đồng & chi phí". */
  contractValue: number | null;
}

export const CUSTOMER_KINDS = ["NEW", "LEAD", "DONE"] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];
export const CUSTOMER_KIND_INFO: Record<CustomerKind, { label: string; hint: string }> = {
  NEW: { label: "Mới", hint: "Chưa có dự án hay hợp đồng nào" },
  LEAD: { label: "Lead", hint: "Chỉ có dự án đang lên kế hoạch / hợp đồng chưa triển khai" },
  DONE: { label: "Đã làm", hint: "Đã có dự án triển khai hoặc hợp đồng" },
};

/**
 * Loại khách hàng from what the company has with us: any project under way or finished, or any
 * contract past "chưa triển khai" → Đã làm; only planned work → Lead; nothing → Mới.
 * Cancelled projects count for nothing.
 */
export function autoKind(projectStatuses: string[], contractStatuses: string[]): CustomerKind {
  if (projectStatuses.some((s) => s === "ACTIVE" || s === "ON_HOLD" || s === "COMPLETED") || contractStatuses.some((s) => s !== "PLANNED")) return "DONE";
  if (projectStatuses.includes("PLANNING") || contractStatuses.length) return "LEAD";
  return "NEW";
}

export const CUSTOMER_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type CustomerSize = (typeof CUSTOMER_SIZES)[number];
export const CUSTOMER_SIZE_INFO: Record<CustomerSize, { label: string; range: string }> = {
  SMALL: { label: "Nhỏ", range: "dưới 50 triệu" },
  MEDIUM: { label: "Vừa", range: "50 – 500 triệu" },
  LARGE: { label: "Lớn", range: "từ 500 triệu" },
};

/** Size by the total contract value (VND); null when there is no contract yet. */
export function customerSize(total: number, contracts: number): CustomerSize | null {
  if (!contracts) return null;
  return total >= 500_000_000 ? "LARGE" : total >= 50_000_000 ? "MEDIUM" : "SMALL";
}

/** The customer page's three project groups: done, under way, planned. Cancelled ones are left out. */
export const PROJECT_STAGES = [
  { key: "done", label: "Đã làm", statuses: ["COMPLETED"] },
  { key: "doing", label: "Đang làm", statuses: ["ACTIVE", "ON_HOLD"] },
  { key: "planned", label: "Dự định làm", statuses: ["PLANNING"] },
] as const;

export interface CustomerProjectDto {
  id: string;
  name: string;
  status: string;
  color: string;
}

/** Contacts grouped by level, in the order the page shows them (top position first). */
export function contactsByLevel(contacts: CustomerContactDto[]): { level: ContactLevel; contacts: CustomerContactDto[] }[] {
  return CONTACT_LEVELS.map((level) => ({
    level,
    contacts: contacts.filter((c) => c.level === level).sort((a, b) => a.name.localeCompare(b.name, "vi")),
  }));
}

/** Lower-case text without Vietnamese marks, so "cong ty" finds "Công ty". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

/** Whether a customer matches a search: its own fields or any of its people. */
export function customerMatches(customer: CustomerDto, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const own = [customer.name, customer.taxCode, customer.industry, customer.address, customer.phone, customer.email];
  const people = customer.contacts.flatMap((c) => [c.name, c.title, c.department, c.phone, c.email]);
  const projects = customer.projects.map((p) => p.name);
  return [...own, ...people, ...projects].some((v) => v && fold(v).includes(q));
}

// ---- Validation (API) ----

/** Optional text: trimmed, empty becomes null. */
const text = (max: number) =>
  z
    .string()
    .max(max, `Tối đa ${max} ký tự`)
    .nullish()
    .transform((v) => (v == null ? v : v.trim() || null));

const email = z
  .string()
  .max(200)
  .nullish()
  .transform((v) => (v == null ? v : v.trim() || null))
  .refine((v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email chưa đúng định dạng");

const day = z
  .string()
  .nullish()
  .transform((v) => (v == null ? v : v.trim() || null))
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Ngày chưa đúng định dạng");

const customerFields = {
  taxCode: text(30),
  industry: text(120),
  address: text(300),
  phone: text(40),
  email,
  website: text(200),
  note: text(2000),
};

export const customerBaseSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên doanh nghiệp").max(200, "Tối đa 200 ký tự"),
  ...customerFields,
});

export const createCustomerSchema = customerBaseSchema.extend({
  /** Loại chosen by hand; null or left out: worked out from projects and contracts. */
  kind: z.enum(CUSTOMER_KINDS).nullish(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

const contactFields = {
  title: text(120),
  department: text(120),
  phone: text(40),
  email,
  birthday: day,
  note: text(2000),
};

export const createContactSchema = z.object({
  level: z.enum(CONTACT_LEVELS),
  name: z.string().trim().min(1, "Nhập họ tên").max(120, "Tối đa 120 ký tự"),
  ...contactFields,
});

export const updateContactSchema = createContactSchema.partial();
