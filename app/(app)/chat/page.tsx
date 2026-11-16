import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { chatPage } from "@/lib/chat-queries";
import { asJson } from "@/lib/json";
import { PageHeader } from "@/components/ui/misc";
import { ChatView } from "@/components/chat/chat-view";

export const metadata = { title: "Trao đổi chung" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** /chat[?m=<messageId>]: the company channel. */
export default async function ChatPage({ searchParams }: { searchParams: SearchParams }) {
  const user = (await getCurrentUser())!;
  const m = (await searchParams).m;
  const [initial, people] = await Promise.all([
    chatPage(user),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, avatarColor: true, jobTitle: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Trao đổi chung" description="Kênh chung của cả công ty. Gõ @ để nhắc một người (họ nhận thông báo), # để gắn công việc; bấm Giao việc để tạo việc ngay từ tin nhắn." />
      <ChatView
        initial={asJson(initial)}
        me={{ id: user.id, name: user.name, avatarColor: user.avatarColor, jobTitle: user.jobTitle }}
        isAdmin={user.role === "ADMIN"}
        people={people}
        focusId={typeof m === "string" ? m : null}
      />
    </div>
  );
}
