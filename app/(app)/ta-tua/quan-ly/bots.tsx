"use client";

import { useState } from "react";
import { Bot, Power } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { ADMIN, errorText, Failure, useLoad, when } from "./shared";

// Town residents run by the server (bots) on the Pet Town board: the target count, the on/off switch, how many exist
// and one row per bot. Players never see which accounts are bots; only this board does. Every change is audited
// by the relay. The rules live in petdex/server/bots.js.

interface BotRow {
  userId: number;
  username: string;
  displayName: string;
  coins: number;
  joinedAt: number;
  lastAction: string | null;
  lastAt: number | null;
  nextAt: number;
  actions: number;
  level: number;
}
interface BotsAdmin {
  config: { enabled: boolean; target: number };
  rules: { max: number; rampPerTick: number; budget: number; clanShare: number; chatPerHour: number };
  count: number;
  players: { total: number; bots: number; real: number };
  bots: BotRow[];
}

const ACTION: Record<string, string> = {
  adopt: "Nhận nuôi bé", daily: "Nhận quà ngày", feed: "Cho bé ăn", buy_food: "Mua đồ ăn", shift: "Đi làm", claim_shift: "Nhận lương",
  game_start: "Chơi câu cá", game_finish: "Câu cá xong", play: "Chơi với bé", bath: "Tắm cho bé", market: "Đặt lệnh Sàn", bank: "Gửi tiết kiệm",
  clan_join: "Vào gia tộc", clan_create: "Lập gia tộc", clan_donate: "Góp quỹ", land_buy: "Mua đất", arena_confirm: "Chọn giờ Đấu trường",
  arena_challenge: "Thách đấu", chat: "Nói ở kênh chung", browse: "Xem quanh",
};

export function BotsTab({ onOpenPlayer }: { onOpenPlayer: (id: number) => void }) {
  const { data, error, loading, reload } = useLoad<BotsAdmin>(`${ADMIN}/bots`);
  const [target, setTarget] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ enabled: boolean; target: number } | null>(null);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  const value = target ?? String(data.config.target);
  const save = async () => {
    if (!confirm) return;
    try {
      await api(`${ADMIN}/bots/config`, { method: "POST", body: confirm });
      toast.success(confirm.enabled ? "Đã lưu cấu hình bot" : "Đã tắt toàn bộ bot");
      setConfirm(null);
      setTarget(null);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Bot className="h-4 w-4 text-muted-foreground" /> Cư dân tự động</span>}
          description={`Bot chơi như người thật qua đúng luật game (người chơi không phân biệt được). Mỗi phút server tạo thêm tối đa ${data.rules.rampPerTick} bot tới số mục tiêu và cho tối đa ${data.rules.budget} bot hành động. Gia tộc của bot không quá ${Math.round(data.rules.clanShare * 100)}% số gia tộc; kênh chung tối đa ${data.rules.chatPerHour} câu bot mỗi giờ. Tắt thì nhịp sau mọi bot dừng (tài khoản vẫn giữ).`}
          action={data.config.enabled
            ? <Badge className="border bg-card text-success">Đang chạy</Badge>
            : <Badge className="border bg-card text-muted-foreground">Đang tắt</Badge>}
        />
        <CardBody className="space-y-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Bot hiện có" value={`${data.count.toLocaleString("vi-VN")} / ${data.config.target.toLocaleString("vi-VN")}`} />
            <Stat label="Người chơi thật" value={data.players.real.toLocaleString("vi-VN")} />
            <Stat label="Tổng tài khoản" value={data.players.total.toLocaleString("vi-VN")} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`Số bot mục tiêu (0–${data.rules.max})`} className="w-48">
              <Input type="number" min={0} max={data.rules.max} step={50} value={value} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Button onClick={() => setConfirm({ enabled: true, target: Number(value) })}>Bật và lưu</Button>
            {data.config.enabled && (
              <Button variant="danger" onClick={() => setConfirm({ enabled: false, target: data.config.target })}>
                <Power className="h-4 w-4" /> Tắt toàn bộ bot
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Danh sách bot" description="Bấm một dòng để xem chi tiết người chơi." />
        <CardBody className="overflow-x-auto pt-3">
          {data.bots.length ? (
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-3 font-medium">Bot</th><th className="px-3 py-2 text-right font-medium">Cấp bé</th><th className="px-3 py-2 text-right font-medium">Xu</th><th className="px-3 py-2 text-right font-medium">Lượt</th><th className="px-3 py-2 font-medium">Việc gần nhất</th><th className="px-3 py-2 font-medium">Lượt tới</th></tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {data.bots.map((b) => (
                  <tr key={b.userId} className="cursor-pointer hover:bg-muted/60" onClick={() => onOpenPlayer(b.userId)}>
                    <td className="py-2 pr-3"><p className="font-medium">{b.displayName}</p><p className="text-xs text-muted-foreground">@{b.username}</p></td>
                    <td className="px-3 py-2 text-right">{b.level}</td>
                    <td className="px-3 py-2 text-right">{b.coins.toLocaleString("vi-VN")}</td>
                    <td className="px-3 py-2 text-right">{b.actions}</td>
                    <td className="px-3 py-2">{b.lastAction ? ACTION[b.lastAction] ?? b.lastAction : b.lastAt ? "Nghỉ" : "Chưa vào game"} <span className="text-xs text-muted-foreground">{b.lastAt ? when(b.lastAt) : ""}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{when(b.nextAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted-foreground">Chưa có bot nào. Đặt số mục tiêu rồi bật.</p>}
        </CardBody>
      </Card>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={save}
        danger={confirm ? !confirm.enabled : false}
        title={confirm?.enabled ? "Bật cư dân tự động" : "Tắt toàn bộ bot"}
        confirmLabel={confirm?.enabled ? "Bật" : "Tắt"}
        message={confirm?.enabled
          ? `Bật bot với mục tiêu ${confirm.target.toLocaleString("vi-VN")} bot. Bot mới được tạo dần, mỗi phút vài bot.`
          : "Mọi bot dừng ở nhịp kế tiếp. Tài khoản bot vẫn giữ nguyên."}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
