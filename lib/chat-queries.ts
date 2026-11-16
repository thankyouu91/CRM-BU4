// Trao đổi chung: reading and writing the company channel. Everyone signed in reads and
// writes it; a task tag shows its live state only to people who may see that task.

import { prisma } from "./prisma";
import { audit } from "./audit";
import { notify } from "./notifications";
import { StatusError } from "./errors";
import { projectVisibilityWhere } from "./rbac";
import type { CurrentUser } from "./session";
import { CHAT_MAX, CHAT_PAGE, chatPlain, chatRefs, keepRefs } from "./chat";

export interface ChatMessageView {
  id: string;
  content: string;
  createdAt: string;
  deleted: boolean;
  author: { id: string; name: string; avatarColor: string; jobTitle: string | null };
}

/** A tagged task as the viewer may see it. */
export interface ChatTaskView {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  assigneeName: string | null;
}

export interface ChatPage {
  messages: ChatMessageView[];
  tasks: Record<string, ChatTaskView>;
  /** Older messages exist before the first one. */
  hasMore: boolean;
}

const authorSelect = { select: { id: true, name: true, avatarColor: true, jobTitle: true } } as const;

async function visibleTasks(viewer: CurrentUser, ids: string[]): Promise<ChatTaskView[]> {
  if (!ids.length) return [];
  const rows = await prisma.task.findMany({
    where: { id: { in: ids }, project: projectVisibilityWhere(viewer) },
    select: { id: true, title: true, status: true, progress: true, dueDate: true, projectId: true, project: { select: { name: true } }, assignee: { select: { name: true } } },
  });
  return rows.map((t) => ({
    id: t.id, title: t.title, status: t.status, progress: t.status === "DONE" ? 100 : t.progress, dueDate: t.dueDate?.toISOString() ?? null,
    projectId: t.projectId, projectName: t.project.name, assigneeName: t.assignee?.name ?? null,
  }));
}

/**
 * Messages oldest first: the latest page, the page before `before`, or everything after
 * `after` (what polling picks up). Cursors are message ids.
 */
export async function chatPage(viewer: CurrentUser, opts: { before?: string | null; after?: string | null } = {}): Promise<ChatPage> {
  const cursorId = opts.after ?? opts.before;
  const cursor = cursorId ? await prisma.chatMessage.findUnique({ where: { id: cursorId }, select: { id: true, createdAt: true } }) : null;
  if (cursorId && !cursor) throw new StatusError("Không tìm thấy tin nhắn", 404);
  const newer = !!opts.after;
  const where = cursor
    ? newer
      ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
      : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
    : {};
  const rows = await prisma.chatMessage.findMany({
    where,
    orderBy: newer ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    take: CHAT_PAGE + 1,
    include: { author: authorSelect },
  });
  const page = rows.slice(0, CHAT_PAGE);
  if (!newer) page.reverse();
  const tasks = await visibleTasks(viewer, [...new Set(page.flatMap((m) => m.taskIds))]);
  return {
    messages: page.map((m) => ({ id: m.id, content: m.deletedAt ? "" : m.content, createdAt: m.createdAt.toISOString(), deleted: !!m.deletedAt, author: m.author })),
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    hasMore: !newer && rows.length > CHAT_PAGE,
  };
}

/** Post to the channel. Mentions of unknown people and tags of tasks the author cannot see become plain text. */
export async function postChatMessage(viewer: CurrentUser, raw: string, now = new Date()): Promise<ChatMessageView> {
  const text = raw.trim();
  if (!text) throw new StatusError("Tin nhắn trống", 400);
  if (text.length > CHAT_MAX) throw new StatusError(`Tin nhắn dài quá ${CHAT_MAX} ký tự`, 400);
  const refs = chatRefs(text);
  const [users, tasks] = await Promise.all([
    refs.users.length ? prisma.user.findMany({ where: { id: { in: refs.users }, active: true }, select: { id: true } }) : [],
    refs.tasks.length
      ? prisma.task.findMany({ where: { id: { in: refs.tasks }, project: projectVisibilityWhere(viewer) }, select: { id: true, assigneeId: true, createdById: true, createdAt: true } })
      : [],
  ]);
  const userIds = new Set(users.map((u) => u.id));
  const taskIds = new Set(tasks.map((t) => t.id));
  const content = keepRefs(text, userIds, taskIds);
  const message = await prisma.chatMessage.create({
    data: { authorId: viewer.id, content, mentions: [...userIds], taskIds: [...taskIds] },
    include: { author: authorSelect },
  });
  // Someone just given a task by this author has had "Bạn được giao…": one notice is enough.
  const justAssigned = new Set(tasks.filter((t) => t.createdById === viewer.id && now.getTime() - t.createdAt.getTime() < 5 * 60_000).map((t) => t.assigneeId));
  const snippet = chatPlain(content).slice(0, 300);
  await notify(
    viewer,
    [...userIds].filter((id) => !justAssigned.has(id)).map((userId) => ({ userId, type: "chat.mention" as const, title: `${viewer.name} nhắc bạn trong Trao đổi chung`, body: snippet, link: `/chat?m=${message.id}` })),
  );
  return { id: message.id, content: message.content, createdAt: message.createdAt.toISOString(), deleted: false, author: message.author };
}

/** Withdraw a message: its author, or an administrator (logged when it is someone else's). */
export async function deleteChatMessage(viewer: CurrentUser, id: string): Promise<void> {
  const message = await prisma.chatMessage.findUnique({ where: { id }, include: { author: { select: { name: true } } } });
  if (!message || message.deletedAt) throw new StatusError("Không tìm thấy tin nhắn", 404);
  const own = message.authorId === viewer.id;
  if (!own && viewer.role !== "ADMIN") throw new StatusError("Bạn chỉ thu hồi được tin nhắn của mình", 403);
  await prisma.chatMessage.update({ where: { id }, data: { deletedAt: new Date(), content: "", mentions: [], taskIds: [] } });
  if (!own) {
    await audit(
      { id: viewer.id, name: viewer.name },
      { action: "chat.delete", entityType: "chat_message", entityId: id, summary: `Thu hồi tin nhắn của ${message.author.name} trong Trao đổi chung`, details: { content: chatPlain(message.content).slice(0, 300) } },
    );
  }
}
