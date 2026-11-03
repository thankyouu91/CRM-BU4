import type { Prisma } from "@prisma/client";
import { resolveMemberRoles } from "./project-members";
import type { CreateProjectInput } from "./validations";
import { InputError } from "./errors";
import { prisma } from "./prisma";

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
