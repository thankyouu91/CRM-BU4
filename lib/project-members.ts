import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { audit } from "./audit";
import type { ProjectRoleKey } from "./permissions";

type Entry = { userId: string; role: ProjectRoleKey };

/**
 * Desired member list -> userId => project role. `members` (explicit roles) wins
 * over `memberIds`, whose people keep their current role or join as MEMBER.
 * The owner is always a MANAGER; unknown user ids are dropped.
 */
export async function resolveMemberRoles(
  ownerId: string,
  input: { members?: Entry[]; memberIds?: string[] },
  current: Map<string, ProjectRoleKey> = new Map(),
): Promise<Map<string, ProjectRoleKey>> {
  const roles = new Map<string, ProjectRoleKey>();
  if (input.members) for (const m of input.members) roles.set(m.userId, m.role);
  else for (const id of input.memberIds ?? []) roles.set(id, current.get(id) ?? "MEMBER");
  roles.set(ownerId, "MANAGER");

  const existing = await prisma.user.findMany({ where: { id: { in: [...roles.keys()] } }, select: { id: true } });
  const known = new Set(existing.map((u) => u.id));
  for (const id of roles.keys()) if (!known.has(id)) roles.delete(id);
  return roles;
}

/** Make the person a member (a viewer becomes one) so work can be given to them. */
export async function joinProject(db: Prisma.TransactionClient, projectId: string, userId: string) {
  await db.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: "MEMBER" },
    update: { role: "MEMBER" },
  });
}

/** Log entry for joining a project to take a task in it. */
export async function logJoin(me: { id: string; name: string }, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  await audit(
    { id: me.id, name: me.name },
    {
      action: "project.members_change",
      entityType: "project",
      entityId: projectId,
      summary: `Tham gia dự án “${project?.name ?? ""}” để nhận việc`,
      details: { added: [{ name: me.name, role: "Thành viên" }], reason: "self-assign" },
    },
  );
}

/** The person joins the project as a member to take a task in it, with a log entry. */
export async function joinSelf(me: { id: string; name: string }, projectId: string) {
  await joinProject(prisma, projectId, me.id);
  await logJoin(me, projectId);
}
