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

// Town residents run by the server (bots) on the Pet Town board: the target count, how many may be online at once,
// the on/off switch, the last tick's cost and one row per bot. Players never see which accounts are bots; only this board does. Every change is audited
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
  online: boolean;
  sessionEnd: number | null;
}
interface BotsAdmin {
  config: { enabled: boolean; target: number; onlineMin: number; onlineMax: number };
  rules: { max: number; rampPerTick: number; budget: number; timeBudgetMs: number; clanShare: number; chatPerHour: number };
  count: number;
  online: number;
  lastTick: { at: number; ms: number; actions: number; created: number; online: number; stopped: string | null } | null;
  today: { day: string; actions: number; sessions: number; created: number };
  players: { total: number; bots: number; real: number };
  bots: BotRow[];
}
type Config = { enabled: boolean; target: number; onlineMin: number; onlineMax: number };

const ACTION: Record<string, string> = {
  adopt: "Nhận nuôi bé", daily: "Nhận quà ngày", feed: "Cho bé ăn", buy_food: "Mua đồ ăn", shift: "Đi làm", claim_shift: "Nhận lương",
  game_start: "Chơi câu cá", game_finish: "Câu cá xong", play: "Chơi với bé", bath: "Tắm cho bé", market: "Đặt lệnh Sàn", bank: "Gửi tiết kiệm",
  clan_join: "Vào gia tộc", clan_create: "Lập gia tộc", clan_donate: "Góp quỹ", land_buy: "Mua đất", arena_confirm: "Chọn giờ Đấu trường",
  arena_challenge: "Thách đấu", chat: "Nói ở kênh chung", browse: "Xem quanh",
};

const STOPPED: Record<string, string> = { budget: "hết lượt nhịp", time: "hết thời gian nhịp", off: "đang tắt" };

export function BotsTab({ onOpenPlayer }: { onOpenPlayer: (id: number) => void }) {
  const { data, error, loading, reload } = useLoad<BotsAdmin>(`${ADMIN}/bots`);
  const [draft, setDraft] = useState<Partial<Record<"target" | "onlineMin" | "onlineMax", string>>>({});
  const [confirm, setConfirm] = useState<Config | null>(null);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  const field = (k: "target" | "onlineMin" | "onlineMax") => draft[k] ?? String(data.config[k]);
  const next = (enabled: boolean): Config => ({ enabled, target: Number(field("target")), onlineMin: Number(field("onlineMin")), onlineMax: Number(field("onlineMax")) });
  const save = async () => {
    if (!confirm) return;
    try {
      await api(`${ADMIN}/bots/config`, { method: "POST", body: confirm });
      toast.success(confirm.enabled ? "Đã lưu cấu hình bot" : "Đã tắt toàn bộ bot");
      setConfirm(null);
      setDraft({});
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const t = data.lastTick;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Bot className="h-4 w-4 text-muted-foreground" /> Cư dân tự động</span>}
          description={`Bot chơi như người thật qua đúng luật game (người chơi không phân biệt được). Mỗi bot có lịch phiên chơi riêng (1–3 phiên/ngày, 20–90 phút, tối đông hơn); chỉ bot đang trong phiên mới làm việc. Mỗi phút server tạo thêm tối đa ${data.rules.rampPerTick} bot tới số mục tiêu, cho tối đa ${data.rules.budget} việc và ${data.rules.timeBudgetMs} ms mỗi nhịp. Gia tộc của bot không quá ${Math.round(data.rules.clanShare * 100)}% số gia tộc; kênh chung tối đa ${data.rules.chatPerHour} câu bot mỗi giờ. Tắt thì nhịp sau mọi bot dừng (tài khoản vẫn giữ).`}
          action={data.config.enabled
            ? <Badge className="border bg-card text-success">Đang chạy</Badge>
            : <Badge className="border bg-card text-muted-foreground">Đang tắt</Badge>}
        />
        <CardBody className="space-y-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tài khoản bot" value={`${data.count.toLocaleString("vi-VN")} / ${data.config.target.toLocaleString("vi-VN")}`} hint={`người thật ${data.players.real.toLocaleString("vi-VN")} · tổng ${data.players.total.toLocaleString("vi-VN")}`} />
            <Stat label="Đang online" value={data.online.toLocaleString("vi-VN")} hint={`giữ trong ${data.config.onlineMin}–${data.config.onlineMax}`} />
            <Stat label="Nhịp gần nhất" value={t ? `${t.ms} ms · ${t.actions} việc` : "Chưa chạy"} hint={t ? `${when(t.at)}${t.created ? ` · tạo ${t.created} bot` : ""}${t.stopped ? ` · dừng: ${STOPPED[t.stopped] ?? t.stopped}` : ""}` : undefined} />
            <Stat label="Hôm nay" value={`${data.today.actions.toLocaleString("vi-VN")} việc`} hint={`${data.today.sessions.toLocaleString("vi-VN")} phiên · ${data.today.created} bot mới`} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`Số bot mục tiêu (0–${data.rules.max})`} className="w-44">
              <Input type="number" min={0} max={data.rules.max} step={50} value={field("target")} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
            </Field>
            <div className="flex gap-1.5 pb-0.5">
              {[50, 200, 500, 1000].map((n) => (
                <Button key={n} size="sm" variant="outline" onClick={() => setDraft({ ...draft, target: String(n) })}>{n.toLocaleString("vi-VN")}</Button>
              ))}
            </div>
            <Field label="Online tối thiểu" className="w-32">
              <Input type="number" min={0} max={data.rules.max} value={field("onlineMin")} onChange={(e) => setDraft({ ...draft, onlineMin: e.target.value })} />
            </Field>
            <Field label="Online tối đa" className="w-32">
              <Input type="number" min={1} max={data.rules.max} value={field("onlineMax")} onChange={(e) => setDraft({ ...draft, onlineMax: e.target.value })} />
            </Field>
            <Button onClick={() => setConfirm(next(true))}>Bật và lưu</Button>
            {data.config.enabled && (
              <Button variant="danger" onClick={() => setConfirm({ ...data.config, enabled: false })}>
                <Power className="h-4 w-4" /> Tắt toàn bộ bot
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Danh sách bot" description="Bot đang online lên đầu, rồi bot vừa làm việc gần nhất (tối đa 300 dòng). Bấm một dòng để xem chi tiết người chơi." />
        <CardBody className="overflow-x-auto pt-3">
          {data.bots.length ? (
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-3 font-medium">Bot</th><th className="px-3 py-2 font-medium">Trạng thái</th><th className="px-3 py-2 text-right font-medium">Cấp bé</th><th className="px-3 py-2 text-right font-medium">Xu</th><th className="px-3 py-2 text-right font-medium">Việc</th><th className="px-3 py-2 font-medium">Việc gần nhất</th><th className="px-3 py-2 font-medium">Lượt tới</th></tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {data.bots.map((b) => (
                  <tr key={b.userId} className="cursor-pointer hover:bg-muted/60" onClick={() => onOpenPlayer(b.userId)}>
                    <td className="py-2 pr-3"><p className="font-medium">{b.displayName}</p><p className="text-xs text-muted-foreground">@{b.username}</p></td>
                    <td className="px-3 py-2">{b.online
                      ? <Badge className="border bg-card text-success">Online{b.sessionEnd ? ` tới ${when(b.sessionEnd).split(" ")[0]}` : ""}</Badge>
                      : <span className="text-xs text-muted-foreground">Offline</span>}</td>
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
          ? `Bật bot: mục tiêu ${confirm.target.toLocaleString("vi-VN")} tài khoản, online cùng lúc ${confirm.onlineMin}–${confirm.onlineMax}. Bot mới được tạo dần, mỗi phút vài bot.`
          : "Mọi bot dừng ở nhịp kế tiếp. Tài khoản bot vẫn giữ nguyên."}
      />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
