"use client";

import { useState } from "react";
import { Swords } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { ADMIN, errorText, Failure, useLoad, when } from "./shared";

// The clan arena on the Pet Town board: fights waiting for a slot or scheduled, and past fights. An admin can
// cancel a fight that has not been fought (nobody loses anything); the relay writes the audit entry.
// The rules live in public/ta-tua/game/js/shared/arena.js and petdex/server/arena.js.

interface ClanRef {
  id: number;
  name: string;
  emblem: string;
}
interface War {
  id: number;
  status: "proposed" | "scheduled" | "done" | "forfeit" | "cancelled";
  challenger: ClanRef;
  defender: ClanRef;
  target: { kind: string; ref: string; name: string };
  slots: number[];
  deadline: number;
  scheduledAt: number | null;
  resolvedAt: number | null;
  winnerId: number | null;
  penalty: number;
  note: string | null;
}
interface ArenaAdmin {
  upcoming: War[];
  history: War[];
}

const STATUS: Record<War["status"], string> = {
  proposed: "Chờ chọn giờ",
  scheduled: "Đã chốt giờ",
  done: "Đã đấu",
  forfeit: "Bỏ trận",
  cancelled: "Đã hủy",
};
const clan = (c: ClanRef) => `${c.emblem} ${c.name}`;

export function ArenaTab() {
  const { data, error, loading, reload } = useLoad<ArenaAdmin>(`${ADMIN}/arena`);
  const [cancel, setCancel] = useState<War | null>(null);
  const [reason, setReason] = useState("");
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  const run = async () => {
    if (!cancel) return;
    try {
      await api(`${ADMIN}/arena/${cancel.id}/cancel`, { method: "POST", body: { reason, challenger: cancel.challenger.name, defender: cancel.defender.name, targetName: cancel.target.name } });
      toast.success("Đã hủy trận");
      setCancel(null);
      setReason("");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Swords className="h-4 w-4 text-muted-foreground" /> Đấu trường: trận đang chờ</span>}
          description="Lời thách đấu chờ bên bị thách chọn giờ (quá 48 giờ thì bên bị thách bị xử thua) và trận đã chốt giờ. Hủy trận chưa đánh thì không bên nào mất gì."
        />
        <CardBody className="overflow-x-auto pt-3">
          <WarTable wars={data.upcoming} empty="Không có trận nào đang chờ." onCancel={setCancel} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Lịch sử Đấu trường" description="50 trận gần nhất: thắng thua, tiền phạt bên thua nộp (một nửa cho bên thắng, một nửa vào ngân sách thị trấn) và ghi chú." />
        <CardBody className="overflow-x-auto pt-3">
          <WarTable wars={data.history} empty="Chưa có trận nào." />
        </CardBody>
      </Card>
      <ConfirmDialog
        open={Boolean(cancel)}
        onClose={() => setCancel(null)}
        onConfirm={run}
        danger
        title="Hủy trận đấu"
        confirmLabel="Hủy trận"
        message={cancel ? (
          <div className="space-y-3">
            <p>Hủy trận #{cancel.id}: {clan(cancel.challenger)} ⚔️ {clan(cancel.defender)} ({cancel.target.name}). Không bên nào mất lô, ghế hay quỹ.</p>
            <Field label="Lý do (ghi vào nhật ký)"><Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} /></Field>
          </div>
        ) : ""}
      />
    </div>
  );
}

function WarTable({ wars, empty, onCancel }: { wars: War[]; empty: string; onCancel?: (w: War) => void }) {
  if (!wars.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <table className="w-full min-w-[48rem] text-sm">
      <thead className="border-b text-left text-xs text-muted-foreground">
        <tr><th className="py-2 pr-3 font-medium">#</th><th className="px-3 py-2 font-medium">Thách đấu</th><th className="px-3 py-2 font-medium">Bị thách</th><th className="px-3 py-2 font-medium">Mục tiêu</th><th className="px-3 py-2 font-medium">Giờ đấu</th><th className="px-3 py-2 font-medium">Trạng thái</th><th className="px-3 py-2 text-right font-medium">Phạt</th><th /></tr>
      </thead>
      <tbody className="divide-y tabular-nums">
        {wars.map((w) => (
          <tr key={w.id}>
            <td className="py-2 pr-3">{w.id}</td>
            <td className="px-3 py-2">{clan(w.challenger)}</td>
            <td className="px-3 py-2">{clan(w.defender)}</td>
            <td className="px-3 py-2">{w.target.name}</td>
            <td className="px-3 py-2 text-xs">{w.scheduledAt ? when(w.scheduledAt) : <span className="text-muted-foreground">hạn chọn {when(w.deadline)}</span>}</td>
            <td className="px-3 py-2">
              <Badge className="border bg-card">{STATUS[w.status]}</Badge>
              {w.winnerId && <span className="ml-1.5 text-xs">thắng: {w.winnerId === w.challenger.id ? w.challenger.name : w.defender.name}</span>}
              {w.note && <p className="text-xs text-muted-foreground">{w.note}</p>}
            </td>
            <td className="px-3 py-2 text-right">{w.penalty ? w.penalty.toLocaleString("vi-VN") : ""}</td>
            <td className="px-3 py-2 text-right">{onCancel && <Button size="sm" variant="danger" onClick={() => onCancel(w)}>Hủy</Button>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
