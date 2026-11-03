"use client";

import { Factory, Link2, Scale, ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { ADMIN, Failure, useLoad, when } from "./shared";

// The commerce office (Sở Công Thương) on the Pet Town board: concentration (HHI) per good on the clans'
// industrial exchange, the essentials clans sell to the supermarket, antitrust taxes collected and accounts that
// joined through the same invite but sit in different clans holding strategic industries. Read-only.
// The rules live in public/ta-tua/game/js/shared/industry.js (MARKET_RULES) and petdex/server/commerce.js.

interface Rules {
  windowDays: number;
  antitrustShare: number;
  antitrustRate: number;
  antitrustMinVolume: number;
  buyCapShare: number;
  buyCapMin: number;
  hhiWarn: number;
  hhiAlert: number;
}
interface GoodRow {
  good: string;
  name: string;
  icon: string;
  qty: number;
  sellers: number;
  hhi: number;
  level: "ok" | "warn" | "alert";
  top: { name: string; share: number };
  avgPrice: number;
  refPrice: number;
  deviation: number;
}
interface EssentialRow {
  cat: string;
  name: string;
  label: string;
  icon: string;
  d: number;
  stock: number[];
  shopQty: number;
  hhi: number;
  sellers: { name: string; share: number }[];
}
interface TaxRow {
  id: number;
  clan: string;
  name: string;
  qty: number;
  tax: number;
  share: number;
  at: number;
}
interface LinkedFlag {
  inviteId: number;
  clans: { id: number; name: string; industries: string[] }[];
  players: { id: number; name: string; clanId: number }[];
}
interface Commerce {
  rules: Rules;
  windowDays: number;
  goods: GoodRow[];
  essentials: EssentialRow[];
  taxes: TaxRow[];
  taxTotal: number;
  linked: LinkedFlag[];
}

const num = (n: number) => Math.round(n).toLocaleString("vi-VN");
const pct = (n: number, digits = 0) => `${(n * 100).toLocaleString("vi-VN", { maximumFractionDigits: digits })}%`;
const LEVEL = { ok: { label: "Bình thường", cls: "text-success" }, warn: { label: "Tập trung", cls: "text-warning" }, alert: { label: "Độc quyền", cls: "text-danger" } };

export function CommerceTab() {
  const { data, error, loading, reload } = useLoad<Commerce>(`${ADMIN}/commerce`);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  const r = data.rules;
  const alerts = data.goods.filter((g) => g.level === "alert").length;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Mặt hàng giao dịch trên sàn" value={data.goods.length} hint={`${data.windowDays} ngày gần nhất`} />
        <Stat label="Mặt hàng độc quyền" value={alerts} hint={`HHI trên ${num(r.hhiAlert)}`} />
        <Stat label="Thuế chống độc quyền" value={`${num(data.taxTotal)} 🪙`} hint={`${data.taxes.length} lần thu trong ${data.windowDays} ngày`} />
        <Stat label="Cờ tài khoản liên kết" value={data.linked.length} hint="cùng link mời, khác gia tộc chiến lược" />
      </div>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Scale className="h-4 w-4 text-muted-foreground" /> Mức tập trung trên sàn công nghiệp</span>}
          description={`HHI theo khối lượng bán giữa các gia tộc trong ${data.windowDays} ngày (0–10.000): trên ${num(r.hhiWarn)} là tập trung, trên ${num(r.hhiAlert)} là độc quyền. Gia tộc bán quá ${pct(r.antitrustShare)} khối lượng một mặt hàng (khi tổng từ ${num(r.antitrustMinVolume)} đv) thì phần vượt chịu thêm ${pct(r.antitrustRate)}. Mỗi gia tộc mua tối đa ${pct(r.buyCapShare)} hàng đang niêm yết của một mặt hàng trong 24 giờ.`}
        />
        <CardBody className="overflow-x-auto pt-3">
          {data.goods.length ? (
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-3 font-medium">Mặt hàng</th><th className="px-3 py-2 text-right font-medium">Khối lượng</th><th className="px-3 py-2 text-right font-medium">Người bán</th><th className="px-3 py-2 text-right font-medium">HHI</th><th className="px-3 py-2 font-medium">Bán nhiều nhất</th><th className="px-3 py-2 text-right font-medium">Giá bình quân</th><th className="px-3 py-2 text-right font-medium">So với tham chiếu</th></tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {data.goods.map((g) => (
                  <tr key={g.good}>
                    <td className="py-2 pr-3">{g.icon} {g.name}</td>
                    <td className="px-3 py-2 text-right">{num(g.qty)}</td>
                    <td className="px-3 py-2 text-right">{g.sellers}</td>
                    <td className={cn("px-3 py-2 text-right font-medium", LEVEL[g.level].cls)}>{num(g.hhi)} <span className="text-xs">· {LEVEL[g.level].label}</span></td>
                    <td className="px-3 py-2">{g.top.name} <span className="text-xs text-muted-foreground">{pct(g.top.share)}</span></td>
                    <td className="px-3 py-2 text-right">{num(g.avgPrice)} <span className="text-xs text-muted-foreground">/ {num(g.refPrice)}</span></td>
                    <td className={cn("px-3 py-2 text-right", Math.abs(g.deviation) > 0.25 && "text-danger")}>{g.deviation > 0 ? "+" : ""}{pct(g.deviation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted-foreground">Chưa có giao dịch nào giữa các gia tộc trong {data.windowDays} ngày.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><ShoppingBasket className="h-4 w-4 text-muted-foreground" /> Hàng thiết yếu bán cho Siêu thị</span>}
          description="Mức tự chủ D của mỗi nhóm, kho hàng gia tộc ở Siêu thị theo hạng Thường / Ngon / Tuyệt hảo và các gia tộc bán nhiều nhất (mỗi gia tộc tối đa 40% lượng thu mua một đêm)."
        />
        <CardBody className="grid gap-4 pt-3 md:grid-cols-2">
          {data.essentials.map((e) => (
            <div key={e.cat} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{e.icon} {e.label}: {pct(e.d)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Kho Siêu thị: {e.stock.map(num).join(" / ")} · đã mua {num(e.shopQty)} đv trong {data.windowDays} ngày · HHI {num(e.hhi)}</p>
              {e.sellers.length ? (
                <ul className="mt-2 space-y-0.5">{e.sellers.map((s) => <li key={s.name} className="flex justify-between"><span>{s.name}</span><span className="tabular-nums">{pct(s.share)}</span></li>)}</ul>
              ) : <p className="mt-2 text-xs text-muted-foreground">Chưa gia tộc nào bán cho Siêu thị.</p>}
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Factory className="h-4 w-4 text-muted-foreground" /> Thuế chống độc quyền đã thu</span>}
          description="Tự trừ vào tiền bán của gia tộc khi giao dịch, vào ngân sách thị trấn."
        />
        <CardBody className="overflow-x-auto pt-3">
          {data.taxes.length ? (
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-3 font-medium">Gia tộc</th><th className="px-3 py-2 font-medium">Mặt hàng</th><th className="px-3 py-2 text-right font-medium">Phần vượt</th><th className="px-3 py-2 text-right font-medium">Thị phần</th><th className="px-3 py-2 text-right font-medium">Thuế</th><th className="px-3 py-2 font-medium">Lúc</th></tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {data.taxes.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3">{t.clan}</td>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2 text-right">{num(t.qty)} đv</td>
                    <td className="px-3 py-2 text-right">{pct(t.share)}</td>
                    <td className="px-3 py-2 text-right">{num(t.tax)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{when(t.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted-foreground">Chưa thu khoản nào.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-muted-foreground" /> Tài khoản liên kết giữa các gia tộc chiến lược</span>}
          description="Người chơi vào game qua cùng một link mời nhưng ở các gia tộc khác nhau, và các gia tộc đó cùng nắm ngành chiến lược. Chỉ để xem xét, hệ thống không tự phạt."
        />
        <CardBody className="space-y-3 pt-3 text-sm">
          {data.linked.length ? data.linked.map((f) => (
            <div key={f.inviteId} className="rounded-lg border p-3">
              <p className="font-medium">Link mời #{f.inviteId}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {f.clans.map((c) => <Badge key={c.id} className="border bg-card">{c.name} · {c.industries.join(", ")}</Badge>)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{f.players.map((p) => `${p.name} (${f.clans.find((c) => c.id === p.clanId)?.name ?? "?"})`).join(" · ")}</p>
            </div>
          )) : <p className="text-muted-foreground">Không có cờ nào.</p>}
        </CardBody>
      </Card>
    </div>
  );
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
