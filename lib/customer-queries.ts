import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { CurrentUser } from "./session";
import { projectVisibilityWhere } from "./rbac";
import type { ContactLevel, CustomerContactDto, CustomerDto } from "./customers";

// Server side of Khách hàng: loading and shaping customers for the page and the API.

const contactSelect = {
  id: true,
  level: true,
  name: true,
  title: true,
  department: true,
  phone: true,
  email: true,
  birthday: true,
  note: true,
} satisfies Prisma.CustomerContactSelect;

export const customerInclude = { contacts: { select: contactSelect, orderBy: { name: "asc" } } } satisfies Prisma.CustomerInclude;

const projectSelect = { id: true, name: true, status: true, color: true } satisfies Prisma.ProjectSelect;

/** The include for a viewer: contacts, plus only the projects that person can see. */
export const customerIncludeFor = (user: CurrentUser) =>
  ({ ...customerInclude, projects: { where: projectVisibilityWhere(user), select: projectSelect, orderBy: { name: "asc" } } }) satisfies Prisma.CustomerInclude;

type CustomerRow = Prisma.CustomerGetPayload<{ include: typeof customerInclude }> & {
  projects?: Prisma.ProjectGetPayload<{ select: typeof projectSelect }>[];
};
type ContactRow = Prisma.CustomerContactGetPayload<{ select: typeof contactSelect }>;

export const contactDto = (c: ContactRow): CustomerContactDto => ({ ...c, level: c.level as ContactLevel });

export function customerDto(c: CustomerRow): CustomerDto {
  return {
    id: c.id,
    name: c.name,
    taxCode: c.taxCode,
    industry: c.industry,
    address: c.address,
    phone: c.phone,
    email: c.email,
    website: c.website,
    note: c.note,
    updatedAt: c.updatedAt.toISOString(),
    contacts: c.contacts.map(contactDto),
    projects: (c.projects ?? []).map((p) => ({ ...p, status: String(p.status) })),
  };
}

/** Every customer with its people and the viewer's visible projects, A to Z by company name. */
export async function customerList(user: CurrentUser): Promise<CustomerDto[]> {
  const rows = await prisma.customer.findMany({ include: customerIncludeFor(user), orderBy: { name: "asc" } });
  return rows.map(customerDto);
}

/** Customers for a picker (project form): id and name only. */
export async function customerOptions(): Promise<{ id: string; name: string }[]> {
  return prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
