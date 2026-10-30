"use client";

import { useMemo, useState } from "react";
import { Building2, CloudSun, Landmark, Map as MapIcon, Receipt, Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import * as rules from "@/public/ta-tua/game/js/shared/clan.js";
import { ADMIN, errorText, Failure, useLoad, when } from "./shared";

// Clans and the land office on the Pet Town board: land prices (auto or manual, per-plot overrides),
// corporate tax and refunds, industry compensation, the macro economy and the tax office's evasion files.
// The rules live in public/ta-tua/game/js/shared/clan.js and petdex/server/clans.js.

type Named = { name: string; icon: string };
const INDUSTRIES = rules.INDUSTRIES as Record<string, Named & { comp: number }>;
const INDUSTRY_ORDER = rules.INDUSTRY_ORDER as string[];
const ZONES = rules.ZONES as Record<string, Named>;
const CLIMATES = rules.CLIMATES as Record<string, Named>;
const PHASES = rules.PHASES as Record<string, Named>;
const WEATHER = rules.WEATHER as Record<string, Named>;

interface ClanConfig {
  createCost: number;
  unlockLevel: number;
  industryLevels: number[];
  expandMultiplier: number;
  baseTax: number;
  extraTaxPerIndustry: number;
  refundRate: number;
  donationQuotaPerLevel: number;
  upkeepPerLevel: number;
  upkeepPerPlot: number;
  comp: Record<string, number>;
  land: { mode: "auto" | "manual"; minPrice: number; maxPrice: number; scarcityK: number; multiplier: number; yieldRate: number; resaleRate: number; maxAppreciation: number; treasuryShare: number };
  macro: { phase: string | null; weather: string | null };
}
interface ClanRow {
  id: number;
  name: string;
  emblem: string;
  color: string;
  level: number;
  xp: number;
  leader: string | null;
  members: number;
  treasury: number;
  industries: string[];
  plots: number;
  landValue: number;
  declareRatio: number;
  revenue30: number;
  tax30: number;
}
interface PlotRow {
  id: number;
  code: string;
  zone: string;
  climate: string;
  growth: number;
  prod: number;
  base: number;
  price: number | null;
  override: number | null;
  owner: string | null;
  industry: string | null;
}
interface Evasion {
  id: number;
  clan_id: number;
  clan_name: string;
  emblem: string;
  day: string;
  revenue: number;
  declared: number;
  rate: number;
  evaded: number;
  status: "open" | "collected" | "dismissed";
  collected: number;
  resolved_by: string | null;
  resolved_at: number | null;
}
interface ClanAdmin {
  config: ClanConfig;
  defaults: ClanConfig;
  stats: { sold: number; free: number; scarcity: number; landIndex: number; industryClans: Record<string, number> };
  macro: { day: string; phase: string; weather: string; landIndex: number; gdp: number; demand: Record<string, number> };
  clans: ClanRow[];
  plots: PlotRow[];
  evasions: Evasion[];
  treasury: number;
}

const coins = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} 🪙`;
const pct = (n: number, digits = 0) => `${(n * 100).toLocaleString("vi-VN", { maximumFractionDigits: digits })}%`;

/** Editable fields: `percent` ones are stored as fractions and shown ×100. */
const FIELDS: { path: string; label: string; hint?: string; percent?: boolean; step?: number; group: "land" | "tax" | "clan" }[] = [
  { path: "land.minPrice", label: "Giá đất thấp nhất", hint: "Lô rẻ nhất trên bản đồ (xu).", group: "land" },
  { path: "land.maxPrice", label: "Giá đất cao nhất", hint: "Lô đắt nhất trên bản đồ (xu).", group: "land" },
  { path: "land.multiplier", label: "Hệ số giá chung", hint: "Nhân với giá mọi lô còn trống.", step: 0.05, group: "land" },
  { path: "land.scarcityK", label: "Độ dốc khan hiếm", hint: "Hết quỹ đất thì giá gấp (1 + k). k = 2: gấp 3.", step: 0.1, group: "land" },
  { path: "land.yieldRate", label: "Sản lượng/ngày theo giá gốc", hint: "Doanh thu một ngày của lô = giá gốc × tỷ lệ này × các hệ số.", percent: true, step: 0.01, group: "land" },
  { path: "land.resaleRate", label: "Giá Sở Nhà Đất mua lại", hint: "Phần trăm giá trị hiện tại khi gia tộc bán lại lô.", percent: true, group: "land" },
  { path: "land.maxAppreciation", label: "Trần tăng giá lô đã mua", hint: "Giá trị lô tăng theo % mỗi tháng tới tối đa bao nhiêu lần giá mua.", step: 0.1, group: "land" },
  { path: "land.treasuryShare", label: "Phần tiền đất vào ngân sách", hint: "Phần còn lại bị hủy khỏi nền kinh tế.", percent: true, group: "land" },
  { path: "baseTax", label: "Thuế doanh nghiệp", hint: "Cho gia tộc một ngành.", percent: true, group: "tax" },
  { path: "extraTaxPerIndustry", label: "Cộng thêm mỗi ngành mở rộng", percent: true, group: "tax" },
  { path: "refundRate", label: "Hoàn thuế cuối tháng", hint: "Trên tổng thuế đã đóng trong tháng.", percent: true, group: "tax" },
  { path: "expandMultiplier", label: "Hệ số phí ngành thứ 2, 3", hint: "Gấp bao nhiêu lần mức bồi thường gốc.", step: 0.5, group: "tax" },
  { path: "createCost", label: "Phí lập gia tộc", group: "clan" },
  { path: "unlockLevel", label: "Cấp bé cần để vào gia tộc", group: "clan" },
  { path: "industryLevels.0", label: "Cấp gia tộc cho ngành 1", group: "clan" },
  { path: "industryLevels.1", label: "Cấp gia tộc cho ngành 2", group: "clan" },
  { path: "industryLevels.2", label: "Cấp gia tộc cho ngành 3", group: "clan" },
  { path: "donationQuotaPerLevel", label: "Định mức góp quỹ/tuần mỗi cấp", hint: "Mỗi thành viên phải góp (định mức × cấp gia tộc) mỗi tuần.", group: "clan" },
  { path: "upkeepPerLevel", label: "Phí duy trì/đêm mỗi cấp", group: "clan" },
  { path: "upkeepPerPlot", label: "Phí duy trì/đêm mỗi lô", group: "clan" },
];

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}
function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let o = obj as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys.at(-1)!] = value;
}
type Draft = Record<string, string>;
function toDraft(c: ClanConfig): Draft {
  const d: Draft = { "land.mode": c.land.mode };
  for (const f of FIELDS) {
    const v = Number(getPath(c, f.path));
    d[f.path] = String(f.percent ? Math.round(v * 10000) / 100 : v);
  }
  for (const id of INDUSTRY_ORDER) d[`comp.${id}`] = String(c.comp[id]);
  return d;
}
function fromDraft(d: Draft, base: ClanConfig): ClanConfig {
  const c = structuredClone(base) as unknown as Record<string, unknown>;
  for (const f of FIELDS) setPath(c, f.path, Number(d[f.path]) / (f.percent ? 100 : 1));
  setPath(c, "land.mode", d["land.mode"]);
  for (const id of INDUSTRY_ORDER) setPath(c, `comp.${id}`, Number(d[`comp.${id}`]));
  return c as unknown as ClanConfig;
}

export function ClansTab() {
  const { data, error, loading, reload } = useLoad<ClanAdmin>(`${ADMIN}/clans`);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  return <ClansBoard data={data} reload={reload} />;
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

function ClansBoard({ data, reload }: { data: ClanAdmin; reload: () => void }) {
  const open = data.evasions.filter((e) => e.status === "open");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Quỹ đất" value={`${data.stats.free}/${data.stats.free + data.stats.sold}`} hint={`còn trống · đã bán ${data.stats.sold} lô`} />
        <Stat label="Hệ số khan hiếm" value={`×${data.stats.scarcity.toFixed(2)}`} hint={`chỉ số giá đất ${data.stats.landIndex.toFixed(3)}`} />
        <Stat label="Gia tộc" value={data.clans.length} hint={`ngân sách thị trấn ${coins(data.treasury)}`} />
        <Stat label="Hồ sơ trốn thuế chờ xử lý" value={open.length} hint={open.length ? `tổng thuế trốn ${coins(open.reduce((s, e) => s + e.evaded, 0))}` : "không có"} />
      </div>
      <TaxOffice evasions={data.evasions} reload={reload} />
      <ConfigCard data={data} reload={reload} />
      <MacroCard data={data} reload={reload} />
      <ClanTable clans={data.clans} />
      <PlotTable plots={data.plots} reload={reload} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Tax office: evasion files the clans never see
// ---------------------------------------------------------------------------------------------

function TaxOffice({ evasions, reload }: { evasions: Evasion[]; reload: () => void }) {
  const [penalty, setPenalty] = useState("50");
  const [confirm, setConfirm] = useState<{ row: Evasion; action: "collect" | "dismiss" } | null>(null);
  const run = async () => {
    if (!confirm) return;
    try {
      await api(`${ADMIN}/clans/evasion/${confirm.row.id}/${confirm.action}`, { method: "POST", body: { penalty: Number(penalty) / 100, clanName: confirm.row.clan_name } });
      toast.success(confirm.action === "collect" ? "Đã truy thu" : "Đã bỏ qua hồ sơ");
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" /> Sở thuế: hồ sơ khai thiếu doanh thu</span>}
        description="Mỗi đêm gia tộc nào khai báo thấp hơn doanh thu thật thì phần thuế thiếu được ghi ở đây. Gia tộc không được thông báo. Truy thu lấy phần thuế trốn cộng tiền phạt từ quỹ gia tộc (tối đa bằng số quỹ đang có) vào ngân sách thị trấn."
        action={<Field label="Tiền phạt (%)" className="w-32"><Input type="number" min={0} max={500} value={penalty} onChange={(e) => setPenalty(e.target.value)} /></Field>}
      />
      <CardBody className="overflow-x-auto pt-3">
        {evasions.length ? (
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="py-2 pr-3 font-medium">Gia tộc</th><th className="px-3 py-2 font-medium">Ngày</th><th className="px-3 py-2 text-right font-medium">Doanh thu</th><th className="px-3 py-2 text-right font-medium">Khai báo</th><th className="px-3 py-2 text-right font-medium">Thuế trốn</th><th className="px-3 py-2 font-medium">Trạng thái</th><th /></tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {evasions.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3">{e.emblem} {e.clan_name}</td>
                  <td className="px-3 py-2">{e.day}</td>
                  <td className="px-3 py-2 text-right">{e.revenue.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2 text-right">{e.declared.toLocaleString("vi-VN")} <span className="text-xs text-muted-foreground">({pct(e.declared / Math.max(1, e.revenue))})</span></td>
                  <td className="px-3 py-2 text-right text-danger">{e.evaded.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2">
                    {e.status === "open" ? <Badge className="border bg-card">Chờ xử lý</Badge>
                      : e.status === "collected" ? <span className="text-xs">Đã truy thu {e.collected.toLocaleString("vi-VN")} · {e.resolved_by} · {when(e.resolved_at)}</span>
                        : <span className="text-xs text-muted-foreground">Bỏ qua · {e.resolved_by}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {e.status === "open" && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="danger" onClick={() => setConfirm({ row: e, action: "collect" })}>Truy thu</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm({ row: e, action: "dismiss" })}>Bỏ qua</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-muted-foreground">Chưa có gia tộc nào khai thiếu.</p>}
      </CardBody>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={run}
        danger={confirm?.action === "collect"}
        title={confirm?.action === "collect" ? "Truy thu thuế" : "Bỏ qua hồ sơ"}
        confirmLabel={confirm?.action === "collect" ? "Truy thu" : "Bỏ qua"}
        message={confirm ? (confirm.action === "collect"
          ? `Thu ${coins(Math.round(confirm.row.evaded * (1 + Number(penalty) / 100)))} (thuế trốn + ${penalty}% phạt) từ quỹ ${confirm.row.clan_name}, ngày ${confirm.row.day}.`
          : `Đóng hồ sơ ngày ${confirm.row.day} của ${confirm.row.clan_name} mà không thu.`) : ""}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Config: land prices, tax, clan rules, industry compensation
// ---------------------------------------------------------------------------------------------

function ConfigCard({ data, reload }: { data: ClanAdmin; reload: () => void }) {
  const saved = useMemo(() => toDraft(data.config), [data.config]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const form = draft ?? saved;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: string, v: string) => setDraft({ ...form, [k]: v });
  const save = async (next: ClanConfig) => {
    setBusy(true);
    try {
      await api(`${ADMIN}/clans/config`, { method: "POST", body: { config: next } });
      toast.success("Đã lưu cấu hình gia tộc & nhà đất");
      setDraft(null);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const input = (f: (typeof FIELDS)[number]) => (
    <Field key={f.path} label={`${f.label}${f.percent ? " (%)" : ""}`} hint={f.hint}>
      <Input type="number" step={f.step ?? (f.percent ? 0.5 : 1)} value={form[f.path]} onChange={(e) => set(f.path, e.target.value)} />
    </Field>
  );
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Scale className="h-4 w-4 text-muted-foreground" /> Giá đất, thuế và luật gia tộc</span>}
        description="Chế độ tự động: giá lô trống = giá gốc × hệ số chung × hệ số khan hiếm × chỉ số giá đất vĩ mô. Chế độ tay: giá gốc × hệ số chung, không tự chạy. Giá đặt riêng từng lô (bảng dưới) luôn được ưu tiên."
        action={dirty ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Hoàn tác</Button>
            <Button size="sm" onClick={() => save(fromDraft(form, data.config))} loading={busy}>Lưu</Button>
          </div>
        ) : <Button size="sm" variant="outline" onClick={() => save({ ...data.defaults, macro: data.config.macro })} loading={busy}>Về mặc định</Button>}
      />
      <CardBody className="space-y-5 pt-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cách tính giá đất" hint={form["land.mode"] === "auto" ? "Tự động theo khan hiếm và vĩ mô." : "Bạn tự đặt, không tự chạy."}>
            <Select value={form["land.mode"]} onChange={(e) => set("land.mode", e.target.value)}>
              <option value="auto">Tự động</option>
              <option value="manual">Thủ công</option>
            </Select>
          </Field>
          {FIELDS.filter((f) => f.group === "land").map(input)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{FIELDS.filter((f) => f.group === "tax").map(input)}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{FIELDS.filter((f) => f.group === "clan").map(input)}</div>
        <div>
          <p className="mb-2 text-[13px] font-medium">Tiền bồi thường thị trường khi thâu tóm ngành (xu)</p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {INDUSTRY_ORDER.map((id) => (
              <Field key={id} label={`${INDUSTRIES[id].icon} ${INDUSTRIES[id].name}`} hint={`${data.stats.industryClans[id] ?? 0} gia tộc đang nắm`}>
                <Input type="number" step={1000} value={form[`comp.${id}`]} onChange={(e) => set(`comp.${id}`, e.target.value)} />
              </Field>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Macro economy
// ---------------------------------------------------------------------------------------------

function MacroCard({ data, reload }: { data: ClanAdmin; reload: () => void }) {
  const [phase, setPhase] = useState(data.config.macro.phase ?? "");
  const [weather, setWeather] = useState(data.config.macro.weather ?? "");
  const [landIndex, setLandIndex] = useState("");
  const [busy, setBusy] = useState(false);
  const m = data.macro;
  const apply = async (today: boolean) => {
    setBusy(true);
    try {
      await api(`${ADMIN}/clans/macro`, { method: "POST", body: { phase: phase || null, weather: weather || null, today, landIndex: today && landIndex ? Number(landIndex) : null } });
      toast.success(today ? "Đã áp dụng cho hôm nay và các ngày tới" : "Đã lưu, áp dụng từ ngày mai");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><CloudSun className="h-4 w-4 text-muted-foreground" /> Kinh tế vĩ mô</span>}
        description="Mỗi đêm hệ thống tự chuyển pha chu kỳ kinh tế, thời tiết, cầu từng ngành và chỉ số giá đất. Pha ảnh hưởng sản lượng lô đất, lượng khách quầy trà sữa và giá đất; thời tiết ảnh hưởng sản lượng theo địa hình/khí hậu và đẩy giá hàng trên Sàn. Bạn có thể ép pha hoặc thời tiết."
      />
      <CardBody className="space-y-4 pt-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>Hôm nay ({m.day}): <b>{PHASES[m.phase]?.icon} {PHASES[m.phase]?.name}</b></span>
          <span><b>{WEATHER[m.weather]?.icon} {WEATHER[m.weather]?.name}</b></span>
          <span>Tăng trưởng <b className="tabular-nums">{pct(m.gdp, 1)}</b></span>
          <span>Chỉ số giá đất <b className="tabular-nums">{m.landIndex.toFixed(3)}</b></span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {INDUSTRY_ORDER.map((id) => {
            const d = m.demand[id] ?? 1;
            return <span key={id} className={cn("rounded-md border px-1.5 py-0.5 tabular-nums", d > 1 ? "text-success" : d < 1 ? "text-danger" : "")}>{INDUSTRIES[id].icon} {d >= 1 ? "+" : ""}{pct(d - 1)}</span>;
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pha kinh tế" hint="Để trống: tự chạy.">
            <Select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="">Tự động</option>
              {Object.entries(PHASES).map(([k, p]) => <option key={k} value={k}>{p.icon} {p.name}</option>)}
            </Select>
          </Field>
          <Field label="Thời tiết" hint="Để trống: ngẫu nhiên mỗi ngày.">
            <Select value={weather} onChange={(e) => setWeather(e.target.value)}>
              <option value="">Tự động</option>
              {Object.entries(WEATHER).map(([k, w]) => <option key={k} value={k}>{w.icon} {w.name}</option>)}
            </Select>
          </Field>
          <Field label="Chỉ số giá đất hôm nay" hint="0,6–1,8. Chỉ dùng khi áp dụng ngay.">
            <Input type="number" step={0.01} min={0.6} max={1.8} placeholder={m.landIndex.toFixed(3)} value={landIndex} onChange={(e) => setLandIndex(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => apply(false)} loading={busy}>Lưu, áp dụng từ ngày mai</Button>
          <Button size="sm" onClick={() => apply(true)} loading={busy}>Áp dụng ngay hôm nay</Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Clans and plots
// ---------------------------------------------------------------------------------------------

function ClanTable({ clans }: { clans: ClanRow[] }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" /> Các gia tộc</span>} description="Tỷ lệ khai báo là phần doanh thu gia tộc tự khai với Sở thuế. Doanh thu và thuế tính trong 30 ngày gần nhất." />
      <CardBody className="overflow-x-auto pt-3">
        {clans.length ? (
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="py-2 pr-3 font-medium">Gia tộc</th><th className="px-3 py-2 font-medium">Tộc trưởng</th><th className="px-3 py-2 text-right font-medium">Cấp</th><th className="px-3 py-2 text-right font-medium">Người</th><th className="px-3 py-2 font-medium">Ngành</th><th className="px-3 py-2 text-right font-medium">Lô</th><th className="px-3 py-2 text-right font-medium">Giá trị đất</th><th className="px-3 py-2 text-right font-medium">Quỹ</th><th className="px-3 py-2 text-right font-medium">Doanh thu 30n</th><th className="px-3 py-2 text-right font-medium">Thuế 30n</th><th className="px-3 py-2 text-right font-medium">Khai báo</th></tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {clans.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-3"><span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.emblem} {c.name}</td>
                  <td className="px-3 py-2">{c.leader}</td>
                  <td className="px-3 py-2 text-right">{c.level}</td>
                  <td className="px-3 py-2 text-right">{c.members}</td>
                  <td className="px-3 py-2">{c.industries.map((i) => INDUSTRIES[i]?.icon).join(" ") || "–"}</td>
                  <td className="px-3 py-2 text-right">{c.plots}</td>
                  <td className="px-3 py-2 text-right">{c.landValue.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2 text-right">{c.treasury.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2 text-right">{c.revenue30.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2 text-right">{c.tax30.toLocaleString("vi-VN")}</td>
                  <td className={cn("px-3 py-2 text-right", c.declareRatio < 1 && "text-danger")}>{pct(c.declareRatio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-muted-foreground">Chưa có gia tộc nào.</p>}
      </CardBody>
    </Card>
  );
}

function PlotTable({ plots, reload }: { plots: PlotRow[]; reload: () => void }) {
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const rows = plots.filter((p) => (!zone || p.zone === zone) && (!status || (status === "free" ? !p.owner : Boolean(p.owner))) && (!q || p.code.toLowerCase().includes(q.toLowerCase())));
  const save = async (p: PlotRow, price: number | null) => {
    setBusy(p.id);
    try {
      await api(`${ADMIN}/clans/plots/${p.id}`, { method: "POST", body: { price, plotCode: p.code } });
      toast.success(price ? `Đã đặt giá lô ${p.code}` : `Lô ${p.code} về giá tự tính`);
      setEdits((e) => { const next = { ...e }; delete next[p.id]; return next; });
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><MapIcon className="h-4 w-4 text-muted-foreground" /> 200 lô đất</span>}
        description="Giá gốc theo khoảng giá đã đặt; giá bán là giá Sở Nhà Đất đang chào cho lô trống. Đặt giá riêng để ghi đè (cả hai chế độ), để trống rồi lưu để về giá tự tính."
        action={
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 w-24" placeholder="Mã lô" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select className="h-8 w-36" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Mọi địa hình</option>
              {Object.entries(ZONES).map(([k, z]) => <option key={k} value={k}>{z.icon} {z.name}</option>)}
            </Select>
            <Select className="h-8 w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="free">Còn trống</option>
              <option value="owned">Đã bán</option>
            </Select>
          </div>
        }
      />
      <CardBody className="max-h-[32rem] overflow-auto pt-3">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="sticky top-0 border-b bg-card text-left text-xs text-muted-foreground">
            <tr><th className="py-2 pr-3 font-medium">Lô</th><th className="px-3 py-2 font-medium">Địa hình · khí hậu</th><th className="px-3 py-2 text-right font-medium">Tăng giá/tháng</th><th className="px-3 py-2 text-right font-medium">Sản xuất</th><th className="px-3 py-2 text-right font-medium">Giá gốc</th><th className="px-3 py-2 text-right font-medium">Giá bán</th><th className="px-3 py-2 font-medium">Chủ</th><th className="px-3 py-2 font-medium">Giá riêng</th></tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {rows.map((p) => {
              const value = edits[p.id] ?? (p.override ? String(p.override) : "");
              const changed = edits[p.id] !== undefined;
              return (
                <tr key={p.id}>
                  <td className="py-1.5 pr-3 font-medium">{p.code}</td>
                  <td className="px-3 py-1.5">{ZONES[p.zone]?.icon} {ZONES[p.zone]?.name} · {CLIMATES[p.climate]?.icon}</td>
                  <td className="px-3 py-1.5 text-right">{pct(p.growth, 1)}</td>
                  <td className="px-3 py-1.5 text-right">{pct(p.prod, 1)}</td>
                  <td className="px-3 py-1.5 text-right">{p.base.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-1.5 text-right">{p.price != null ? p.price.toLocaleString("vi-VN") : "–"}</td>
                  <td className="px-3 py-1.5">{p.owner ? <span>{p.owner}{p.industry ? ` · ${INDUSTRIES[p.industry]?.icon}` : ""}</span> : <span className="text-muted-foreground">Trống</span>}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input className="h-8 w-32 text-right" type="number" step={1000} placeholder="Tự tính" value={value} onChange={(e) => setEdits((x) => ({ ...x, [p.id]: e.target.value }))} />
                      {changed && <Button size="sm" loading={busy === p.id} onClick={() => save(p, value ? Number(value) : null)}>Lưu</Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground"><Building2 className="mx-auto mb-2 h-5 w-5" />Không có lô nào khớp bộ lọc.</p>}
      </CardBody>
    </Card>
  );
}
