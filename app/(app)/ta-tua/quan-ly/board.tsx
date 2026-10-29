"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Coins, Copy, Gamepad2, Gift, Link2, Pencil, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";
import { inviteUrl, playUrl } from "@/lib/petdex-public";

// Pet Town management board. Everything goes through /api/ta-tua/admin/* (administrators only),
// which relays to the game server and writes WorkHub's audit log.

const ADMIN = "/api/ta-tua/admin";
const KIND_LABEL: Record<string, string> = { member: "Nhân viên", guest: "Khách mời", player: "Tự đăng ký" };
const STAT_LABEL: Record<string, string> = { fullness: "No bụng", happiness: "Vui vẻ", energy: "Năng lượng", hygiene: "Sạch sẽ", health: "Sức khỏe" };
const STATS = Object.keys(STAT_LABEL);
const TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "players", label: "Người chơi" },
  { key: "invites", label: "Link mời khách" },
  { key: "log", label: "Nhật ký" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const coins = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} 🪙`;
const when = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "Chưa");
const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "Đã có lỗi xảy ra");

interface Player {
  id: number;
  username: string;
  displayName: string;
  kind: string;
  coins: number;
  savings: number;
  netWorth: number;
  pets: number;
  topLevel: number;
  credit: number;
  banned: boolean;
  online: boolean;
  createdAt: number;
  lastSeenAt: number;
  inviteId: number | null;
}
interface Pet {
  id: number;
  name: string;
  species: string;
  level: number;
  xp: number;
  xpNext: number;
  fullness: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  sick: { name?: string } | null;
  skills: Record<string, number>;
  age: { stage?: { name?: string }; weeks?: number };
  mood: { label?: string };
}
interface Detail {
  player: Player;
  pets: Pet[];
  inventory: Record<string, number>;
  netWorth: { total: number; parts: Record<string, number> };
  ledger: { id: number; delta: number; balance: number; kind: string; memo: string | null; at: number }[];
  invite: { label: string } | null;
  skills: Record<string, { name: string }>;
  slots: { max: number; used: number; free: number };
  /** What can be taken right now: wallet + savings account (term deposits are locked). */
  spendable: { wallet: number; savings: number };
  species: { id: string; name: string; element: string; rarity: string }[];
}
interface Overview {
  byKind: { kind: string; n: number; coins: number; banned: number }[];
  activeToday: number;
  activeWeek: number;
  savings: number;
  pets: number;
  ledger7d: { kind: string; inflow: number; outflow: number; n: number }[];
  treasury: number;
  economy: { priceIndex: number; baseRate: number };
  online: number;
  rich: { userId: number; displayName: string; total: number }[];
  kinds: Record<string, string>;
}
interface Invite {
  id: number;
  code: string;
  label: string;
  max_uses: number | null;
  uses: number;
  expires_at: number | null;
  created_by: string;
  created_at: number;
  revoked_at: number | null;
  usable: boolean;
  guests: number;
}
interface LogRow {
  id: number;
  actor: string;
  action: string;
  user_id: number | null;
  username: string | null;
  display_name: string | null;
  details: Record<string, unknown> | null;
  created_at: number;
}

export function Board() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div>
      <PageHeader
        title="Quản lý Pet Town"
        description="Người chơi, xu, chỉ số thú cưng, link mời khách và nhật ký. Mọi thay đổi đều ghi vào nhật ký hệ thống."
        actions={
          <Link href="/ta-tua" className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium hover:bg-muted">
            <Gamepad2 className="h-4 w-4" /> Vào chơi
          </Link>
        }
      />
      <div role="tablist" className="mb-5 flex w-fit gap-0.5 rounded-lg border bg-muted/60 p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", tab === t.key ? "bg-card font-medium shadow-card" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "players" && <PlayersTab />}
      {tab === "invites" && <InvitesTab />}
      {tab === "log" && <LogTab />}
    </div>
  );
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    api<T>(url)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false));
  }, [url]);
  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardBody className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function Failure({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card>
      <EmptyState icon={Gamepad2} title="Không đọc được dữ liệu game" description={error} action={<Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="h-4 w-4" /> Thử lại</Button>} />
    </Card>
  );
}

function OverviewTab() {
  const { data, error, loading, reload } = useLoad<Overview>(`${ADMIN}/overview`);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const count = (kind: string) => data.byKind.find((k) => k.kind === kind)?.n ?? 0;
  const wallets = data.byKind.reduce((s, k) => s + (k.coins ?? 0), 0);
  const banned = data.byKind.reduce((s, k) => s + (k.banned ?? 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Nhân viên đã tham gia" value={count("member")} hint={`${count("guest")} khách mời${count("player") ? `, ${count("player")} tự đăng ký` : ""}`} />
        <Stat label="Hoạt động" value={data.activeToday} hint={`hôm nay · ${data.activeWeek} trong 7 ngày · ${data.online} đang ở công viên`} />
        <Stat label="Xu trong ví" value={coins(wallets)} hint={`tiết kiệm ${coins(data.savings)}`} />
        <Stat label="Ngân sách thị trấn" value={coins(data.treasury)} hint={`chỉ số giá ${data.economy.priceIndex.toFixed(2)} · lãi ${(data.economy.baseRate * 100).toFixed(1)}%/ngày`} />
        <Stat label="Thú cưng" value={data.pets} />
        <Stat label="Tài khoản bị khoá" value={banned} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Dòng xu 7 ngày theo hạng mục" description="Tổng xu vào và ra ví người chơi theo từng loại giao dịch." />
          <CardBody className="pt-3">
            {data.ledger7d.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-1.5 font-medium">Hạng mục</th><th className="py-1.5 text-right font-medium">Lượt</th><th className="py-1.5 text-right font-medium">Vào</th><th className="py-1.5 text-right font-medium">Ra</th></tr>
                </thead>
                <tbody className="divide-y">
                  {data.ledger7d.map((row) => (
                    <tr key={row.kind}>
                      <td className="py-1.5">{data.kinds[row.kind] ?? row.kind}</td>
                      <td className="py-1.5 text-right tabular-nums">{row.n}</td>
                      <td className="py-1.5 text-right tabular-nums text-success">{row.inflow ? `+${row.inflow.toLocaleString("vi-VN")}` : "–"}</td>
                      <td className="py-1.5 text-right tabular-nums text-danger">{row.outflow ? `−${row.outflow.toLocaleString("vi-VN")}` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có giao dịch nào trong 7 ngày.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Giàu nhất phố" description="Tài sản ròng: ví, tiết kiệm, hàng hoá, đồ đạc trừ nợ." />
          <CardBody className="pt-3">
            {data.rich.length ? (
              <ol className="divide-y text-sm">
                {data.rich.map((r, i) => (
                  <li key={r.userId} className="flex items-center gap-3 py-1.5">
                    <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate">{r.displayName}</span>
                    <span className="tabular-nums">{coins(r.total)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có người chơi.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function PlayersTab() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(typed.trim()), 250);
    return () => clearTimeout(t);
  }, [typed]);
  const url = useMemo(() => `${ADMIN}/players?${new URLSearchParams({ q, kind })}`, [q, kind]);
  const { data, error, loading, reload } = useLoad<{ players: Player[] }>(url);
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Tìm theo tên" className="w-64 pl-8" aria-label="Tìm người chơi" />
        </div>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-40" aria-label="Loại tài khoản">
          <option value="">Tất cả</option>
          <option value="member">Nhân viên</option>
          <option value="guest">Khách mời</option>
          <option value="player">Tự đăng ký</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={reload} aria-label="Tải lại"><RefreshCw className="h-4 w-4" /></Button>
        {data && <span className="text-xs text-muted-foreground">{data.players.length} người chơi</span>}
      </div>
      {error ? (
        <Failure error={error} onRetry={reload} />
      ) : (
        <Card className="overflow-hidden">
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : data?.players.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Người chơi</th>
                    <th className="px-3 py-2.5 font-medium">Loại</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ví</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tiết kiệm</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tài sản</th>
                    <th className="px-3 py-2.5 text-right font-medium">Bé / cấp</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tín dụng</th>
                    <th className="px-3 py-2.5 font-medium">Hoạt động</th>
                    <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.players.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setOpenId(p.id)}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{p.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{p.username}</p>
                      </td>
                      <td className="px-3 py-2.5"><Badge>{KIND_LABEL[p.kind] ?? p.kind}</Badge></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.coins.toLocaleString("vi-VN")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.savings.toLocaleString("vi-VN")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.netWorth.toLocaleString("vi-VN")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.pets ? `${p.pets} · L${p.topLevel}` : "–"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.credit}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.online ? <span className="text-success">Đang ở công viên</span> : when(p.lastSeenAt)}</td>
                      <td className="px-4 py-2.5">{p.banned ? <span className="flex items-center gap-1 text-xs text-danger"><Ban className="h-3.5 w-3.5" /> Bị khoá</span> : <span className="text-xs text-muted-foreground">Bình thường</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Users} title="Chưa có người chơi nào" description="Nhân viên mở mục Pet Town lần đầu sẽ xuất hiện ở đây; khách mời vào bằng link." />
          )}
        </Card>
      )}
      <PlayerDrawer id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
    </div>
  );
}

function PlayerDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (id === null) return;
    api<Detail>(`${ADMIN}/players/${id}`)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((err) => setError(errorText(err)));
  }, [id]);
  useEffect(() => {
    setDetail(null);
    load();
  }, [load]);
  const changed = () => {
    load();
    onChanged();
  };
  return (
    <Drawer open={id !== null} onClose={onClose} width="max-w-3xl">
      {error && <Failure error={error} onRetry={load} />}
      {!error && !detail && <div className="space-y-3 p-6">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>}
      {detail && <PlayerDetail detail={detail} onChanged={changed} onClose={onClose} />}
    </Drawer>
  );
}

function PlayerDetail({ detail, onChanged, onClose }: { detail: Detail; onChanged: () => void; onClose: () => void }) {
  const { player } = detail;
  const [delta, setDelta] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(player.displayName);

  const spendable = detail.spendable.wallet + detail.spendable.savings;
  const [confirmAll, setConfirmAll] = useState<number | null>(null);
  const adjust = async (sign: 1 | -1, clamp = false) => {
    const amount = Math.abs(Math.trunc(Number(delta)));
    if (!amount) return toast.error("Nhập số xu");
    // More than the player has: offer to take everything available instead of failing.
    if (sign < 0 && amount > spendable && !clamp) {
      if (spendable <= 0) return toast.error("Người chơi không còn xu trong ví hay tiết kiệm để trừ");
      return setConfirmAll(amount);
    }
    setBusy(true);
    try {
      const res = await api<{ coins: number; delta: number; fromSavings: number }>(`${ADMIN}/players/${player.id}/coins`, { method: "POST", body: { delta: sign * amount, memo, clamp, playerName: player.displayName } });
      const done = Math.abs(res.delta);
      toast.success(`${sign > 0 ? "Đã cộng" : "Đã trừ"} ${done.toLocaleString("vi-VN")} xu${res.fromSavings ? ` (${res.fromSavings.toLocaleString("vi-VN")} từ tiết kiệm)` : ""}, ví còn ${res.coins.toLocaleString("vi-VN")}`);
      setDelta("");
      setMemo("");
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const toggleBan = async () => {
    try {
      await api(`${ADMIN}/players/${player.id}/status`, { method: "POST", body: { banned: !player.banned, playerName: player.displayName } });
      toast.success(player.banned ? "Đã mở khoá" : "Đã khoá tài khoản chơi");
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const rename = async () => {
    try {
      await api(`${ADMIN}/players/${player.id}/name`, { method: "POST", body: { displayName: name, playerName: player.displayName } });
      toast.success("Đã đổi tên");
      setRenaming(false);
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-56" maxLength={40} autoFocus />
              <Button size="sm" onClick={rename}>Lưu</Button>
              <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>Huỷ</Button>
            </div>
          ) : (
            <h2 className="flex items-center gap-2 text-base font-semibold">
              {player.displayName}
              <button onClick={() => setRenaming(true)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Đổi tên"><Pencil className="h-3.5 w-3.5" /></button>
            </h2>
          )}
          <p className="text-xs text-muted-foreground">
            @{player.username} · {KIND_LABEL[player.kind] ?? player.kind}
            {detail.invite ? ` · link “${detail.invite.label}”` : ""} · tham gia {when(player.createdAt)} · hoạt động {when(player.lastSeenAt)}
          </p>
        </div>
        <Button variant={player.banned ? "outline" : "danger"} size="sm" onClick={() => setConfirmBan(true)}>
          {player.banned ? <><ShieldCheck className="h-4 w-4" /> Mở khoá</> : <><Ban className="h-4 w-4" /> Khoá</>}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Đóng</Button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Ví" value={player.coins.toLocaleString("vi-VN")} />
          <Stat label="Tiết kiệm" value={player.savings.toLocaleString("vi-VN")} />
          <Stat label="Tài sản ròng" value={detail.netWorth.total.toLocaleString("vi-VN")} hint={detail.netWorth.parts.debt ? `nợ ${Math.abs(detail.netWorth.parts.debt).toLocaleString("vi-VN")}` : undefined} />
          <Stat label="Tín dụng" value={player.credit} />
        </div>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground" /> Cộng hoặc trừ xu</span>} description={`Ghi vào sổ cái của người chơi với lý do. Trừ thì lấy ví trước, thiếu thì lấy tiếp từ tiết kiệm; trừ được tối đa ${spendable.toLocaleString("vi-VN")} xu. Hàng hoá, đồ đạc và tiền gửi kỳ hạn trong tài sản ròng không trừ được.`} />
          <CardBody className="grid gap-3 pt-3 sm:grid-cols-[10rem_1fr_auto_auto]">
            <Field label="Số xu"><Input type="number" min={1} step={1} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="500" /></Field>
            <Field label="Lý do"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Thưởng tháng, đền bù lỗi…" maxLength={120} /></Field>
            <div className="flex items-end"><Button onClick={() => adjust(1)} loading={busy}>+ Cộng</Button></div>
            <div className="flex items-end"><Button variant="outline" onClick={() => adjust(-1)} loading={busy}>− Trừ</Button></div>
          </CardBody>
        </Card>

        <GrantPet detail={detail} onChanged={onChanged} />

        <div>
          <h3 className="mb-2 text-sm font-semibold">Thú cưng và chỉ số</h3>
          {detail.pets.length ? (
            <div className="space-y-3">{detail.pets.map((pet) => <PetEditor key={pet.id} pet={pet} player={player} skills={detail.skills} onChanged={onChanged} />)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa nhận nuôi bé nào.</p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Giao dịch gần đây</h3>
          {detail.ledger.length ? (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {detail.ledger.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{when(row.at)}</td>
                      <td className="px-3 py-1.5">{row.memo ?? row.kind}</td>
                      <td className={cn("px-3 py-1.5 text-right tabular-nums", row.delta >= 0 ? "text-success" : "text-danger")}>{row.delta >= 0 ? "+" : "−"}{Math.abs(row.delta).toLocaleString("vi-VN")}</td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">{row.balance.toLocaleString("vi-VN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmAll !== null}
        onClose={() => setConfirmAll(null)}
        onConfirm={async () => { await adjust(-1, true); }}
        title="Không đủ xu để trừ"
        message={`Bạn muốn trừ ${(confirmAll ?? 0).toLocaleString("vi-VN")} xu, nhưng ${player.displayName} chỉ có ${detail.spendable.wallet.toLocaleString("vi-VN")} xu trong ví${detail.spendable.savings ? ` và ${detail.spendable.savings.toLocaleString("vi-VN")} xu tiết kiệm` : ""}. Trừ hết ${spendable.toLocaleString("vi-VN")} xu đang có?`}
        confirmLabel={`Trừ hết ${spendable.toLocaleString("vi-VN")} xu`}
        danger
      />
      <ConfirmDialog
        open={confirmBan}
        onClose={() => setConfirmBan(false)}
        onConfirm={toggleBan}
        title={player.banned ? "Mở khoá tài khoản chơi?" : "Khoá tài khoản chơi?"}
        message={player.banned ? `${player.displayName} sẽ vào chơi lại được.` : `${player.displayName} sẽ bị đăng xuất khỏi game và không vào lại được cho tới khi mở khoá. Dữ liệu chơi được giữ nguyên.`}
        confirmLabel={player.banned ? "Mở khoá" : "Khoá"}
        danger={!player.banned}
      />
    </div>
  );
}

const RARITY_LABEL: Record<string, string> = { huyenthoai: "Huyền thoại", quy: "Quý", hiem: "Hiếm", thuong: "Thường" };
const RARITY_ORDER = ["huyenthoai", "quy", "hiem", "thuong"];
const ELEMENT_LABEL: Record<string, string> = { kim: "Kim", moc: "Mộc", thuy: "Thủy", hoa: "Hỏa", tho: "Thổ" };

/** Give a player a new pet of any species, rare ones included; it takes a free pet slot. */
function GrantPet({ detail, onChanged }: { detail: Detail; onChanged: () => void }) {
  const { player, slots } = detail;
  const [species, setSpecies] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const groups = RARITY_ORDER.map((r) => [r, detail.species.filter((s) => s.rarity === r)] as const).filter(([, list]) => list.length);
  const others = detail.species.filter((s) => !RARITY_ORDER.includes(s.rarity));
  const chosen = detail.species.find((s) => s.id === species);
  const grant = async () => {
    if (!chosen) return toast.error("Chọn một loài");
    setBusy(true);
    try {
      await api(`${ADMIN}/players/${player.id}/pets`, { method: "POST", body: { species: chosen.id, name: name.trim() || chosen.name, playerName: player.displayName, speciesName: chosen.name } });
      toast.success(`Đã tặng ${name.trim() || chosen.name} cho ${player.displayName}`);
      setSpecies("");
      setName("");
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Gift className="h-4 w-4 text-muted-foreground" /> Tặng thú cưng</span>}
        description={`Tặng bất kỳ loài nào, kể cả loài hiếm chỉ nở từ trứng. Bé mới chiếm một ô nuôi: đang dùng ${slots.used}/${slots.max}.`}
      />
      <CardBody className="grid gap-3 pt-3 sm:grid-cols-[1fr_12rem_auto]">
        <Field label="Loài">
          <Select value={species} onChange={(e) => setSpecies(e.target.value)} aria-label="Loài">
            <option value="">Chọn loài…</option>
            {groups.map(([rarity, list]) => (
              <optgroup key={rarity} label={RARITY_LABEL[rarity]}>
                {list.map((s) => <option key={s.id} value={s.id}>{s.name} · {ELEMENT_LABEL[s.element] ?? s.element}</option>)}
              </optgroup>
            ))}
            {others.length > 0 && <optgroup label="Khác">{others.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>}
          </Select>
        </Field>
        <Field label="Tên bé" hint="trống = tên loài"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={chosen?.name ?? "Tên"} maxLength={16} /></Field>
        <div className="flex items-start pt-6"><Button onClick={grant} loading={busy} disabled={!chosen || slots.free <= 0}><Gift className="h-4 w-4" /> Tặng</Button></div>
        {slots.free <= 0 && <p className="text-xs text-danger sm:col-span-3">Người chơi đã hết ô nuôi; cần giải phóng một ô trong game trước.</p>}
      </CardBody>
    </Card>
  );
}

function PetEditor({ pet, player, skills, onChanged }: { pet: Pet; player: Player; skills: Record<string, { name: string }>; onChanged: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const value = (key: string, current: number) => form[key] ?? String(current);
  const set = (key: string, v: string) => setForm((f) => ({ ...f, [key]: v }));
  const dirty = Object.keys(form).length > 0;
  const save = async () => {
    const body: Record<string, unknown> = { playerName: player.displayName, petName: pet.name };
    const skillBody: Record<string, number> = {};
    for (const [key, v] of Object.entries(form)) {
      if (key.startsWith("skill:")) skillBody[key.slice(6)] = Number(v);
      else body[key] = Number(v);
    }
    if (Object.keys(skillBody).length) body.skills = skillBody;
    setBusy(true);
    try {
      await api(`${ADMIN}/players/${player.id}/pets/${pet.id}`, { method: "POST", body });
      toast.success(`Đã cập nhật ${pet.name}`);
      setForm({});
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={`${pet.name} · cấp ${pet.level}`}
        description={`${pet.species}${pet.age?.stage?.name ? ` · ${pet.age.stage.name}` : ""}${pet.mood?.label ? ` · ${pet.mood.label}` : ""}${pet.sick ? ` · đang ốm${pet.sick.name ? ` (${pet.sick.name})` : ""}` : ""}`}
        action={dirty ? <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setForm({})}>Hoàn tác</Button><Button size="sm" onClick={save} loading={busy}>Lưu</Button></div> : null}
      />
      <CardBody className="grid gap-3 pt-3 sm:grid-cols-4 lg:grid-cols-7">
        {STATS.map((key) => (
          <Field key={key} label={STAT_LABEL[key]}>
            <Input type="number" min={0} max={100} step={1} value={value(key, (pet as unknown as Record<string, number>)[key])} onChange={(e) => set(key, e.target.value)} />
          </Field>
        ))}
        <Field label="Cấp"><Input type="number" min={1} max={100} step={1} value={value("level", pet.level)} onChange={(e) => set("level", e.target.value)} /></Field>
        <Field label="XP" hint={`cần ${pet.xpNext}`}><Input type="number" min={0} step={1} value={value("xp", pet.xp)} onChange={(e) => set("xp", e.target.value)} /></Field>
        {Object.entries(skills).map(([key, s]) => (
          <Field key={key} label={s.name}>
            <Input type="number" min={0} max={100} step={0.1} value={value(`skill:${key}`, pet.skills?.[key] ?? 0)} onChange={(e) => set(`skill:${key}`, e.target.value)} />
          </Field>
        ))}
      </CardBody>
    </Card>
  );
}

function InvitesTab() {
  const { data, error, loading, reload } = useLoad<{ invites: Invite[] }>(`${ADMIN}/invites`);
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const linkOf = (code: string) => inviteUrl(code);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`${ADMIN}/invites`, { method: "POST", body: { label, maxUses: maxUses || null, expiresAt: expires ? new Date(`${expires}T23:59:59`).getTime() : null } });
      toast.success("Đã tạo link mời");
      setLabel("");
      setMaxUses("");
      setExpires("");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(code));
      toast.success("Đã chép link");
    } catch {
      toast.error("Không chép được, hãy chọn và sao chép thủ công");
    }
  };
  const revoke = async () => {
    if (!revoking) return;
    try {
      await api(`${ADMIN}/invites/${revoking.id}/revoke`, { method: "POST", body: {} });
      toast.success("Đã thu hồi link");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Tạo link mời khách"
          description={<>Người nhận link chỉ cần điền tên là vào chơi, không cần tài khoản WorkHub. Có thể giới hạn số lượt và hạn dùng. Khách đã vào thì lần sau mở thẳng <a href={playUrl()} target="_blank" rel="noreferrer" className="underline">{playUrl().replace(/^https?:\/\//, "")}</a>.</>}
        />
        <CardBody className="grid gap-3 pt-3 sm:grid-cols-[1fr_8rem_11rem_auto]">
          <Field label="Nhãn"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bạn bè phòng Marketing" maxLength={60} /></Field>
          <Field label="Số lượt" hint="trống = không giới hạn"><Input type="number" min={1} max={10000} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="∞" /></Field>
          <Field label="Hạn dùng" hint="trống = vô thời hạn"><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
          <div className="flex items-end"><Button onClick={create} loading={busy}><Link2 className="h-4 w-4" /> Tạo link</Button></div>
        </CardBody>
      </Card>
      {error ? (
        <Failure error={error} onRetry={reload} />
      ) : (
        <Card className="overflow-hidden">
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : data?.invites.length ? (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Nhãn</th>
                  <th className="px-3 py-2.5 font-medium">Link</th>
                  <th className="px-3 py-2.5 text-right font-medium">Đã dùng</th>
                  <th className="px-3 py-2.5 font-medium">Hạn</th>
                  <th className="px-3 py-2.5 font-medium">Tạo bởi</th>
                  <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.invites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2.5 font-medium">{inv.label}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <code className="max-w-[16rem] truncate rounded bg-muted px-1.5 py-0.5 text-xs">{linkOf(inv.code)}</code>
                        <button onClick={() => copy(inv.code)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Chép link"><Copy className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{inv.uses}{inv.max_uses ? ` / ${inv.max_uses}` : ""}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{inv.expires_at ? when(inv.expires_at) : "Vô thời hạn"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{inv.created_by} · {when(inv.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {inv.revoked_at ? (
                        <span className="text-xs text-muted-foreground">Đã thu hồi</span>
                      ) : inv.usable ? (
                        <Button size="sm" variant="ghost" onClick={() => setRevoking(inv)}>Thu hồi</Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Hết lượt hoặc hết hạn</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={Link2} title="Chưa có link mời nào" description="Tạo link ở trên rồi gửi cho người ngoài WorkHub." />
          )}
        </Card>
      )}
      <ConfirmDialog open={revoking !== null} onClose={() => setRevoking(null)} onConfirm={revoke} title="Thu hồi link mời?" message={`Link “${revoking?.label}” sẽ không nhận khách mới. Khách đã vào vẫn chơi tiếp.`} confirmLabel="Thu hồi" danger />
    </div>
  );
}

const LOG_LABEL: Record<string, string> = { coins: "Cộng/trừ xu", pet: "Sửa chỉ số bé", pet_grant: "Tặng thú cưng", ban: "Khoá", unban: "Mở khoá", rename: "Đổi tên", invite: "Tạo link mời", invite_revoke: "Thu hồi link" };

function LogTab() {
  const { data, error, loading, reload } = useLoad<{ log: LogRow[] }>(`${ADMIN}/log?limit=100`);
  if (error) return <Failure error={error} onRetry={reload} />;
  const describe = (row: LogRow) => {
    const d = row.details ?? {};
    if (row.action === "coins") return `${Number(d.delta) >= 0 ? "+" : "−"}${Math.abs(Number(d.delta)).toLocaleString("vi-VN")} xu${d.memo ? ` · ${String(d.memo)}` : ""} · ví còn ${Number(d.balance).toLocaleString("vi-VN")}`;
    if (row.action === "pet") return `${String(d.petName ?? "")}: ${Object.entries((d.changes as Record<string, number>) ?? {}).map(([k, v]) => `${STAT_LABEL[k] ?? k} ${v}`).concat(Object.entries((d.skills as Record<string, number>) ?? {}).map(([k, v]) => `${k} ${v}`)).join(", ")}`;
    if (row.action === "pet_grant") return `${String(d.petName ?? "")} (${String(d.speciesName ?? d.species ?? "")}${d.rarity ? `, ${RARITY_LABEL[String(d.rarity)] ?? String(d.rarity)}` : ""})`;
    if (row.action === "rename") return `${String(d.from ?? "")} → ${String(d.to ?? "")}`;
    if (row.action === "invite") return `“${String(d.label ?? "")}”${d.maxUses ? ` · ${String(d.maxUses)} lượt` : ""}`;
    if (row.action === "invite_revoke") return `#${String(d.id ?? "")}`;
    return "";
  };
  return (
    <Card className="overflow-hidden">
      {loading && !data ? (
        <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : data?.log.length ? (
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">Thời gian</th><th className="px-3 py-2.5 font-medium">Quản trị viên</th><th className="px-3 py-2.5 font-medium">Thao tác</th><th className="px-3 py-2.5 font-medium">Người chơi</th><th className="px-4 py-2.5 font-medium">Chi tiết</th></tr>
          </thead>
          <tbody className="divide-y">
            {data.log.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{when(row.created_at)}</td>
                <td className="px-3 py-2.5">{row.actor}</td>
                <td className="px-3 py-2.5">{LOG_LABEL[row.action] ?? row.action}</td>
                <td className="px-3 py-2.5">{row.display_name ?? row.username ?? "–"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{describe(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={ShieldCheck} title="Chưa có thao tác nào" description="Cộng trừ xu, sửa chỉ số, khoá tài khoản và link mời sẽ được ghi ở đây." />
      )}
    </Card>
  );
}
