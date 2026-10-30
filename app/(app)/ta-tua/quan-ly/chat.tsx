"use client";

import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { ADMIN, errorText, Failure, useLoad, when } from "./shared";

// In-game chat and mailbox on the Pet Town board: mail (optionally with coins) to one player or everyone,
// recent chat with delete and mute. The rules live in petdex/server/chat.js.

interface ChatMessage {
  id: number;
  userId: number;
  name: string;
  username: string;
  channel: string;
  text: string;
  at: number;
}

const CHANNELS: Record<string, string> = { "": "Mọi kênh", world: "Kênh chung" };
const channelName = (c: string) => (c === "world" ? "Kênh chung" : c.startsWith("clan:") ? `Gia tộc #${c.slice(5)}` : "Tin nhắn riêng");

export function ChatTab() {
  return (
    <div className="space-y-4">
      <MailCard />
      <ChatCard />
    </div>
  );
}

function MailCard() {
  const [to, setTo] = useState<"all" | "one">("one");
  const [playerId, setPlayerId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [gift, setGift] = useState("0");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const coins = Number(gift) || 0;
  const ready = subject.trim() && (to === "all" || Number(playerId) > 0) && Number.isInteger(coins) && coins >= 0;

  const send = async () => {
    setBusy(true);
    try {
      const res = await api<{ sent: number }>(`${ADMIN}/mail`, { method: "POST", body: { to: to === "all" ? "all" : Number(playerId), subject: subject.trim(), body, coins } });
      toast.success(`Đã gửi ${res.sent.toLocaleString("vi-VN")} lá thư`);
      setSubject("");
      setBody("");
      setGift("0");
      setConfirming(false);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> Gửi thư vào hộp thư người chơi</span>}
        description="Thư hiện trong Hộp thư 📬 của game với tên Ban quản lý Pet Town. Xu đính kèm do người chơi bấm Nhận (một lần), ghi sổ là “Quà trong hộp thư”."
      />
      <CardBody className="grid gap-3 pt-3 sm:grid-cols-2">
        <Field label="Gửi cho">
          <Select value={to} onChange={(e) => setTo(e.target.value as "all" | "one")}>
            <option value="one">Một người chơi (theo ID)</option>
            <option value="all">Mọi người chơi (trừ tài khoản bị khoá)</option>
          </Select>
        </Field>
        {to === "one" ? (
          <Field label="ID người chơi"><Input type="number" min={1} value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder="Xem ở tab Người chơi" /></Field>
        ) : <div />}
        <Field label="Tiêu đề" className="sm:col-span-2"><Input maxLength={80} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Nội dung" className="sm:col-span-2"><Textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <Field label="Xu đính kèm (mỗi lá)"><Input type="number" min={0} value={gift} onChange={(e) => setGift(e.target.value)} /></Field>
        <div className="flex items-end justify-end"><Button disabled={!ready || busy} onClick={() => setConfirming(true)}>Gửi thư</Button></div>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={send}
        danger={to === "all" && coins > 0}
        title="Gửi thư"
        confirmLabel="Gửi"
        message={`Gửi “${subject.trim()}” cho ${to === "all" ? "mọi người chơi" : `người chơi #${playerId}`}${coins ? `, mỗi lá kèm ${coins.toLocaleString("vi-VN")} xu` : ""}.`}
      />
    </Card>
  );
}

function ChatCard() {
  const [channel, setChannel] = useState("");
  const { data, error, loading, reload } = useLoad<{ messages: ChatMessage[] }>(`${ADMIN}/chat?${new URLSearchParams({ channel })}`);
  const [confirm, setConfirm] = useState<{ row: ChatMessage; action: "delete" | "mute" | "unmute" } | null>(null);
  const [hours, setHours] = useState("24");

  const run = async () => {
    if (!confirm) return;
    const { row, action } = confirm;
    try {
      if (action === "delete") await api(`${ADMIN}/chat/${row.id}/delete`, { method: "POST", body: { author: row.name } });
      else await api(`${ADMIN}/players/${row.userId}/mute`, { method: "POST", body: { hours: action === "mute" ? Number(hours) : 0, playerName: row.name } });
      toast.success(action === "delete" ? "Đã xoá tin nhắn" : action === "mute" ? "Đã cấm chat" : "Đã bỏ cấm chat");
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" /> Trò chuyện gần đây</span>}
        description="200 tin mới nhất. Xoá tin vi phạm hoặc cấm chat (không nhắn và không gửi thư được) trong một số giờ. Kênh chung giữ 7 ngày, kênh gia tộc và tin riêng 60 ngày."
        action={
          <div className="flex gap-2">
            <Field label="Kênh" className="w-36"><Select value={channel} onChange={(e) => setChannel(e.target.value)}>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label="Cấm (giờ)" className="w-24"><Input type="number" min={1} max={8760} value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
          </div>
        }
      />
      <CardBody className="overflow-x-auto pt-3">
        {error ? <Failure error={error} onRetry={reload} /> : loading || !data ? <Skeleton className="h-32" /> : data.messages.length ? (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="py-2 pr-3 font-medium">Lúc</th><th className="px-3 py-2 font-medium">Kênh</th><th className="px-3 py-2 font-medium">Người gửi</th><th className="px-3 py-2 font-medium">Nội dung</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {data.messages.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">{when(m.at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{channelName(m.channel)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{m.name} <span className="text-xs text-muted-foreground">#{m.userId}</span></td>
                  <td className="px-3 py-2 break-words">{m.text}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="danger" onClick={() => setConfirm({ row: m, action: "delete" })}>Xoá</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ row: m, action: "mute" })}>Cấm chat</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ row: m, action: "unmute" })}>Bỏ cấm</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={MessageSquare} title="Chưa có tin nhắn nào" />}
      </CardBody>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={run}
        danger={confirm?.action !== "unmute"}
        title={confirm?.action === "delete" ? "Xoá tin nhắn" : confirm?.action === "mute" ? "Cấm chat" : "Bỏ cấm chat"}
        confirmLabel={confirm?.action === "delete" ? "Xoá" : confirm?.action === "mute" ? "Cấm" : "Bỏ cấm"}
        message={confirm ? (confirm.action === "delete"
          ? `Xoá tin “${confirm.row.text.slice(0, 80)}” của ${confirm.row.name}.`
          : confirm.action === "mute" ? `Cấm ${confirm.row.name} chat và gửi thư ${hours} giờ.` : `Cho ${confirm.row.name} chat lại ngay.`) : ""}
      />
    </Card>
  );
}
