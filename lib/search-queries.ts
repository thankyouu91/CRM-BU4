import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { hasPermission } from "./permissions";
import { canViewAllProjects } from "./rbac";
import { FOLD_FROM, FOLD_TO, SEARCH_LIMIT, likePatterns, type SearchResults } from "./search";
import type { CurrentUser } from "./session";

// Raw SQL so matching ignores tone marks (Postgres translate(), no extension).
// Every value, including the folding tables, is a bound parameter.

type Patterns = ReturnType<typeof likePatterns>;

/** `expr` folded like foldSearch: lowercase, no tone marks. */
const foldSql = (expr: Prisma.Sql) => Prisma.sql`lower(translate(${expr}, ${FOLD_FROM}, ${FOLD_TO}))`;
const like = (hay: Prisma.Sql, pattern: string) => Prisma.sql`${hay} LIKE ${pattern} ESCAPE '\\'`;
/** 0 for a match at the start or at a word start, 1 for one inside a word. */
const rank = (hay: Prisma.Sql, pat: Patterns) => Prisma.sql`CASE WHEN ${like(hay, pat.prefix)} OR ${like(hay, pat.word)} THEN 0 ELSE 1 END`;

/** Same rule as projectVisibilityWhere (lib/rbac.ts) for the project aliased `p`. */
function visibleProjectSql(user: CurrentUser) {
  if (canViewAllProjects(user)) return Prisma.sql`TRUE`;
  return Prisma.sql`(p."ownerId" = ${user.id} OR EXISTS (SELECT 1 FROM "ProjectMember" m WHERE m."projectId" = p.id AND m."userId" = ${user.id}))`;
}

type ProjectRow = SearchResults["projects"][number];
type TaskRow = { id: string; title: string; status: string; dueDate: Date | null; projectId: string; projectName: string; projectColor: string; assignee: string | null };
type ContractRow = NonNullable<SearchResults["contracts"]>[number];
type PersonRow = SearchResults["people"][number];

/** GET /api/search: projects and tasks the user can see, contracts (with FINANCE_MANAGE) and active people. */
export async function quickSearch(user: CurrentUser, query: string) {
  const pat = likePatterns(query);
  const visible = visibleProjectSql(user);
  const finance = hasPermission(user, "FINANCE_MANAGE");

  const projectName = foldSql(Prisma.sql`p.name`);
  const taskTitle = foldSql(Prisma.sql`t.title`);
  const contractText = foldSql(Prisma.sql`concat_ws(' ', c.code, c.name, c.partner)`);
  const personText = foldSql(Prisma.sql`concat_ws(' ', u.name, u."jobTitle")`);

  const [projects, tasks, contracts, people] = await Promise.all([
    prisma.$queryRaw<ProjectRow[]>(Prisma.sql`
      SELECT p.id, p.name, p.status::text AS status, p.color FROM "Project" p
      WHERE ${visible} AND ${like(projectName, pat.contains)}
      ORDER BY ${rank(projectName, pat)}, p."updatedAt" DESC, p.id LIMIT ${SEARCH_LIMIT}`),
    prisma.$queryRaw<TaskRow[]>(Prisma.sql`
      SELECT t.id, t.title, t.status::text AS status, t."dueDate", p.id AS "projectId", p.name AS "projectName", p.color AS "projectColor", a.name AS assignee
      FROM "Task" t JOIN "Project" p ON p.id = t."projectId" LEFT JOIN "User" a ON a.id = t."assigneeId"
      WHERE ${visible} AND ${like(taskTitle, pat.contains)}
      ORDER BY ${rank(taskTitle, pat)}, t."updatedAt" DESC, t.id LIMIT ${SEARCH_LIMIT}`),
    finance
      ? prisma.$queryRaw<ContractRow[]>(Prisma.sql`
          SELECT c.id, c.code, c.name, c.partner, c.status::text AS status FROM "Contract" c
          WHERE ${like(contractText, pat.contains)}
          ORDER BY ${rank(contractText, pat)}, c."updatedAt" DESC, c.id LIMIT ${SEARCH_LIMIT}`)
      : null,
    // Everyone signed in sees the active directory with emails on the team page.
    prisma.$queryRaw<PersonRow[]>(Prisma.sql`
      SELECT u.id, u.name, u."jobTitle", u.email, u."avatarColor" FROM "User" u
      WHERE u.active AND ${like(personText, pat.contains)}
      ORDER BY ${rank(personText, pat)}, u."updatedAt" DESC, u.id LIMIT ${SEARCH_LIMIT}`),
  ]);

  return {
    projects,
    tasks: tasks.map(({ projectId, projectName, projectColor, ...t }) => ({ ...t, project: { id: projectId, name: projectName, color: projectColor } })),
    ...(contracts ? { contracts } : {}),
    people,
  };
}
