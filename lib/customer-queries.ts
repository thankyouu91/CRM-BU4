import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
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

type CustomerRow = Prisma.CustomerGetPayload<{ include: typeof customerInclude }>;
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
  };
}

/** Every customer with its people, A to Z by company name. */
export async function customerList(): Promise<CustomerDto[]> {
  const rows = await prisma.customer.findMany({ include: customerInclude, orderBy: { name: "asc" } });
  return rows.map(customerDto);
}
