import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { CurrentUser } from "./session";
import { projectVisibilityWhere } from "./rbac";
import { hasPermission } from "./permissions";
import { autoKind, CUSTOMER_KINDS, customerSize, type ContactLevel, type CustomerContactDto, type CustomerDto, type CustomerKind } from "./customers";

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

/** What a company has with us: every project and contract, whoever can see them (kind and size). */
interface Facts {
  projects: string[];
  contracts: string[];
  total: number;
}

async function factsOf(ids: string[]): Promise<Map<string, Facts>> {
  const rows = await prisma.project.findMany({
    where: { customerId: { in: ids } },
    select: { customerId: true, status: true, contracts: { select: { value: true, status: true } } },
  });
  const out = new Map<string, Facts>();
  for (const r of rows) {
    const f = out.get(r.customerId!) ?? { projects: [], contracts: [], total: 0 };
    if (r.status === "CANCELLED") continue;
    f.projects.push(r.status);
    for (const c of r.contracts) {
      f.contracts.push(c.status);
      f.total += Number(c.value);
    }
    out.set(r.customerId!, f);
  }
  return out;
}

function customerDto(c: CustomerRow & { kind: string | null }, f: Facts | undefined, money: boolean): CustomerDto {
  const kindAuto = autoKind(f?.projects ?? [], f?.contracts ?? []);
  const manual = CUSTOMER_KINDS.includes(c.kind as CustomerKind) ? (c.kind as CustomerKind) : null;
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
    kind: manual ?? kindAuto,
    kindAuto,
    kindManual: !!manual,
    size: customerSize(f?.total ?? 0, f?.contracts.length ?? 0),
    contractValue: money && f?.contracts.length ? f.total : null,
  };
}

/** Customers as the viewer sees them: their projects, kind and size (amounts only with "Hợp đồng & chi phí"). */
export async function customerDtos(rows: (CustomerRow & { kind: string | null })[], user: CurrentUser): Promise<CustomerDto[]> {
  const facts = rows.length ? await factsOf(rows.map((r) => r.id)) : new Map<string, Facts>();
  const money = hasPermission(user, "FINANCE_MANAGE");
  return rows.map((r) => customerDto(r, facts.get(r.id), money));
}

/** Every customer with its people and the viewer's visible projects, A to Z by company name. */
export async function customerList(user: CurrentUser): Promise<CustomerDto[]> {
  const rows = await prisma.customer.findMany({ include: customerIncludeFor(user), orderBy: { name: "asc" } });
  return customerDtos(rows, user);
}

/** One customer as the viewer sees it, or null. */
export async function customerFor(id: string, user: CurrentUser): Promise<CustomerDto | null> {
  const row = await prisma.customer.findUnique({ where: { id }, include: customerIncludeFor(user) });
  return row ? (await customerDtos([row], user))[0] : null;
}

/** Customers for a picker (project form): id and name only. */
export async function customerOptions(): Promise<{ id: string; name: string }[]> {
  return prisma.customer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
