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
}

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

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên doanh nghiệp").max(200, "Tối đa 200 ký tự"),
  ...customerFields,
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
