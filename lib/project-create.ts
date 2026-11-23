import type { Prisma } from "@prisma/client";
import { resolveMemberRoles } from "./project-members";
import type { CreateProjectInput } from "./validations";
import { InputError } from "./errors";
import { prisma } from "./prisma";
import { audit } from "./audit";

/** A project cannot end before it starts (either date may be missing). */
export function checkProjectDates(startDate: Date | null | undefined, dueDate: Date | null | undefined) {
  if (startDate && dueDate && dueDate.getTime() < startDate.getTime()) {
    throw new InputError("Hạn hoàn thành của dự án không được trước ngày bắt đầu");
  }
}

/** A customer id from a project form: it must exist (null or empty means none). */
export async function checkCustomer(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const found = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!found) throw new InputError("Khách hàng đã chọn không còn trong danh sách, hãy chọn lại");
  return found.id;
}

/**
 * The customer a project form asks for: the one chosen from the list, or the company named in
 * the box. A name already in the list (ignoring case) is reused; a new one is added to the
 * customer list, logged. undefined: leave the project's customer as it is.
 */
export async function resolveCustomer(
  actor: { id: string; name: string },
  input: { customerId?: string | null; customerName?: string | null },
  projectName: string,
): Promise<string | null | undefined> {
  if (input.customerId) return checkCustomer(input.customerId);
  const name = input.customerName?.trim();
  if (!name) return input.customerId === undefined && input.customerName === undefined ? undefined : null;
  const existing = await prisma.customer.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (existing) return existing.id;
  const customer = await prisma.customer.create({ data: { name, createdById: actor.id }, select: { id: true } });
  await audit(actor, {
    action: "customer.create",
    entityType: "customer",
    entityId: customer.id,
    summary: `Thêm khách hàng “${name}” (khi lưu dự án “${projectName.trim()}”)`,
    details: { name, fromProject: projectName.trim() },
  });
  return customer.id;
}

/**
 * The row for a new project owned by `ownerId`, with its member list (the owner is
 * always a project manager). Shared by POST /api/projects and projects made from a
 * template, so both create the same way.
 */
export async function newProjectData(
  ownerId: string,
  input: Pick<CreateProjectInput, "name" | "description" | "status" | "color" | "startDate" | "dueDate" | "members" | "memberIds" | "customerId">,
) {
  checkProjectDates(input.startDate, input.dueDate);
  const roles = await resolveMemberRoles(ownerId, input);
  const customerId = await checkCustomer(input.customerId);
  const data = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: input.status,
    color: input.color ?? "#6366f1",
    startDate: input.startDate,
    dueDate: input.dueDate,
    ownerId,
    customerId,
    members: { create: [...roles].map(([userId, role]) => ({ userId, role })) },
  } satisfies Prisma.ProjectUncheckedCreateInput;
  return { data, roles };
}
