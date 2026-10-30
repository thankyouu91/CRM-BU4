"use client";

import { useState } from "react";
import { Landmark, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { ADMIN, errorText, Failure, useLoad, when } from "./shared";

// Clan banks on the Pet Town board: each bank's capital, deposits, loans and defaults, the deposit insurance fund,
// and the emergency freeze (one bank or all of them). The freeze is audited by the relay. Rules live in
// public/ta-tua/game/js/shared/clan-bank.js, the server in petdex/server/clan-bank.js.

interface BankRow {
  clanId: number; name: string; emblem: string; status: string; frozen: boolean; reputation: number; holder: boolean;
  rates: Record<string, number>; loanRate: number; lendingOpen: boolean;
  cash: number; deposits: number; loans: number; equity: number; floor: number; liquidity: number;
  depositors: number; queued: number; queuedCount: number; queuedSince: number | null;
  defaults: number; defaultLost: number; openedAt: number; failedAt: number | null;
}
interface LoanRow {
  id: number; bank: string; clan: string; plotId: number; amount: number; owed: number; paid: number; left: number;
  status: string; lateNights: number; dueAt: number; openedAt: number;
}
interface AuctionRow { id: number; plotCode: string; bank: string; debtor: string; startPrice: number; topBid: number | null; topClan: string | null; endsAt: number }
interface ClanBankAdmin { frozen: boolean; insurance: number; baseRate: number; banks: BankRow[]; loans: LoanRow[]; auctions: AuctionRow[] }
type Freeze = { clanId: number | null; clanName?: string; frozen: boolean };

const xu = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} xu`;
const rate = (r: number) => `${(r * 100).toLocaleString("vi-VN", { maximumFractionDigits: 3 })}%/ngày`;
const LOAN: Record<string, string> = { active: "Đang nợ", late: "Quá hạn", repaid: "Đã trả", defaulted: "Vỡ nợ, đã siết lô", written_off: "Vỡ nợ, mất trắng" };

export function ClanBankTab() {
  const { data, error, loading, reload } = useLoad<ClanBankAdmin>(`${ADMIN}/clan-bank`);
  const [confirm, setConfirm] = useState<Freeze | null>(null);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  const save = async () => {
    if (!confirm) return;
    try {
      await api(`${ADMIN}/clan-bank/freeze`, { method: "POST", body: confirm });
      toast.success(confirm.frozen ? "Đã phong tỏa" : "Đã gỡ phong tỏa");
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const totals = data.banks.reduce((s, b) => ({ deposits: s.deposits + b.deposits, loans: s.loans + b.loans, cash: s.cash + b.cash }), { deposits: 0, loans: 0, cash: 0 });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" /> Ngân hàng gia tộc</span>}
          description={`Gia tộc nắm Ngân hàng nhà nước nhận tiền gửi (lãi tối đa 3 lần lãi tiết kiệm, đang là ${rate(data.baseRate * 3)}) và cho vay thế chấp lô đất. Phong tỏa thì dừng gửi, rút, vay và chi trả đáo hạn; vẫn thu nợ.`}
          action={data.frozen
            ? <Button variant="outline" onClick={() => setConfirm({ clanId: null, frozen: false })}><Unlock className="h-4 w-4" /> Gỡ phong tỏa toàn bộ</Button>
            : <Button variant="danger" onClick={() => setConfirm({ clanId: null, frozen: true })}><Lock className="h-4 w-4" /> Phong tỏa toàn bộ</Button>}
        />
        <CardBody className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Quỹ bảo hiểm tiền gửi" value={xu(data.insurance)} />
          <Stat label="Tổng tiền gửi" value={xu(totals.deposits)} hint={`${data.banks.filter((b) => b.status === "open").length} ngân hàng đang mở`} />
          <Stat label="Tổng đang cho vay" value={xu(totals.loans)} />
          <Stat label="Tiền mặt" value={xu(totals.cash)} hint={data.frozen ? "đang phong tỏa toàn bộ" : undefined} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Từng ngân hàng" description="Tiền mặt tối thiểu là 20% tiền gửi. Lệnh rút xếp hàng quá 3 đêm thì ngân hàng đổ vỡ." />
        <CardBody className="overflow-x-auto pt-3">
          {data.banks.length ? (
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>{["Ngân hàng", "Trạng thái", "Tiền mặt", "Tiền gửi", "Cho vay", "Vốn chủ", "Uy tín", "Xếp hàng rút", "Vỡ nợ", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {data.banks.map((b) => (
                  <tr key={b.clanId}>
                    <td className="px-3 py-2"><p className="font-medium">{b.emblem} {b.name}</p><p className="text-xs text-muted-foreground">mở {when(b.openedAt)}{b.holder ? "" : " · không còn nắm Ngân hàng nhà nước"}</p></td>
                    <td className="px-3 py-2">{b.status === "failed" ? <Badge className="border bg-card text-danger">Đổ vỡ {when(b.failedAt)}</Badge> : b.frozen ? <Badge className="border bg-card text-warning">Phong tỏa</Badge> : <Badge className="border bg-card text-success">Đang mở</Badge>}</td>
                    <td className="px-3 py-2">{xu(b.cash)}<p className="text-xs text-muted-foreground">tối thiểu {xu(b.floor)} · {Math.round(b.liquidity * 100)}%</p></td>
                    <td className="px-3 py-2">{xu(b.deposits)}<p className="text-xs text-muted-foreground">{b.depositors} người</p></td>
                    <td className="px-3 py-2">{xu(b.loans)}<p className="text-xs text-muted-foreground">{b.lendingOpen ? `mở, ${rate(b.loanRate)}` : "đóng"}</p></td>
                    <td className="px-3 py-2">{xu(b.equity)}</td>
                    <td className="px-3 py-2">{b.reputation}</td>
                    <td className="px-3 py-2">{b.queuedCount ? <span className="text-danger">{b.queuedCount} lệnh · {xu(b.queued)}<br /><span className="text-xs">từ {when(b.queuedSince)}</span></span> : "Không"}</td>
                    <td className="px-3 py-2">{b.defaults ? `${b.defaults} khoản · mất ${xu(b.defaultLost)}` : "Không"}</td>
                    <td className="px-3 py-2 text-right">{b.status === "open" && (b.frozen
                      ? <Button size="sm" variant="outline" onClick={() => setConfirm({ clanId: b.clanId, clanName: b.name, frozen: false })}>Gỡ phong tỏa</Button>
                      : <Button size="sm" variant="danger" onClick={() => setConfirm({ clanId: b.clanId, clanName: b.name, frozen: true })}>Phong tỏa</Button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted-foreground">Chưa có gia tộc nào mở ngân hàng.</p>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Khoản vay" description="Khoản đang nợ lên đầu (tối đa 100 dòng)." />
        <CardBody className="overflow-x-auto pt-3">
          {data.loans.length ? (
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>{["#", "Ngân hàng", "Gia tộc vay", "Gốc", "Còn nợ", "Trạng thái", "Hạn"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {data.loans.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">{l.id}</td><td className="px-3 py-2">{l.bank}</td><td className="px-3 py-2">{l.clan}</td>
                    <td className="px-3 py-2">{xu(l.amount)}</td><td className="px-3 py-2">{xu(l.left)}</td>
                    <td className="px-3 py-2">{LOAN[l.status] ?? l.status}{l.lateNights ? ` (${l.lateNights} đêm)` : ""}</td><td className="px-3 py-2">{when(l.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted-foreground">Chưa có khoản vay nào.</p>}
          {data.auctions.length > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-medium">Đấu giá lô siết nợ đang mở</p>
              {data.auctions.map((a) => <p key={a.id}>Lô {a.plotCode} của {a.debtor} (chủ nợ {a.bank}): {a.topBid ? `${xu(a.topBid)} của ${a.topClan}` : `khởi điểm ${xu(a.startPrice)}`}, đóng {when(a.endsAt)}</p>)}
            </div>
          )}
        </CardBody>
      </Card>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={save}
        danger={confirm?.frozen ?? false}
        title={confirm?.frozen ? "Phong tỏa khẩn cấp" : "Gỡ phong tỏa"}
        confirmLabel={confirm?.frozen ? "Phong tỏa" : "Gỡ"}
        message={`${confirm?.frozen ? "Phong tỏa" : "Gỡ phong tỏa"} ${confirm?.clanId == null ? "toàn bộ ngân hàng gia tộc" : `ngân hàng ${confirm.clanName}`}. ${confirm?.frozen ? "Người chơi tạm không gửi, rút hay vay được; khoản đáo hạn chưa được chi trả cho tới khi gỡ." : "Hàng chờ rút sẽ được trả nếu đủ tiền mặt."}`}
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
