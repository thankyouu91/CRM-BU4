import { prisma } from "./prisma";
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
