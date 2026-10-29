"use client";

import { useMemo, useState } from "react";
import { Copy, Gift, Plus, RotateCcw, Shirt, Sparkles, Ticket, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import * as rules from "@/public/ta-tua/game/js/shared/gear.js";
import { ADMIN, errorText, Failure, useLoad, when } from "./shared";

// Tiered gear (blue, green, gold, red with 1 to 4 bonus lines) and gift codes on the Pet Town board.
// The rules live in public/ta-tua/game/js/shared/gear.js, shared with the game server and client.

type Tier = "blue" | "green" | "gold" | "red";
type Affix = "income" | "stats" | "trade" | "luck";
const TIER_ORDER = rules.TIER_ORDER as Tier[];
const AFFIX_ORDER = rules.AFFIX_ORDER as Affix[];
const TIERS: Record<Tier, { name: string; color: string; lines: number }> = rules.TIERS;
const AFFIXES: Record<Affix, { name: string; icon: string; desc: string }> = rules.AFFIXES;
const BONUS_CAP: number = rules.BONUS_CAP;

const SLOT_LABEL: Record<string, string> = { head: "Đầu", face: "Mặt", neck: "Cổ", back: "Lưng" };
const SOURCE_LABEL: Record<string, string> = { shop: "Mua ở cửa hàng", minigame: "Rớt từ mini-game", gift: "Mã quà", admin: "Quản trị tặng", legacy: "Đồ cũ chuyển sang" };
const tierName = (t: string) => (TIERS as Record<string, { name: string }>)[t]?.name ?? t;

export function TierDot({ tier, className }: { tier: string; className?: string }) {
  const meta = (TIERS as Record<string, { name: string; color: string }>)[tier];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", className)}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta?.color ?? "currentColor" }} />
      {meta?.name ?? tier}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Gear config: tier odds, bonus ranges per tier, mini-game drop rates
// ---------------------------------------------------------------------------------------------

interface GearConfig {
  odds: Record<Tier, number>;
  ranges: Record<Tier, Record<Affix, [number, number]>>;
  materialChance: number;
  materialQty: [number, number];
  gearDropChance: number;
}
interface Draft {
  odds: Record<string, string>;
  ranges: Record<string, Record<string, [string, string]>>;
  materialChance: string;
  materialQty: [string, string];
  gearDropChance: string;
}

const toDraft = (c: GearConfig): Draft => ({
  odds: Object.fromEntries(TIER_ORDER.map((t) => [t, String(c.odds[t])])),
  ranges: Object.fromEntries(TIER_ORDER.map((t) => [t, Object.fromEntries(AFFIX_ORDER.map((a) => [a, [String(c.ranges[t][a][0]), String(c.ranges[t][a][1])]]))])),
  materialChance: String(c.materialChance),
  materialQty: [String(c.materialQty[0]), String(c.materialQty[1])],
  gearDropChance: String(c.gearDropChance),
});
const fromDraft = (d: Draft) => ({
  odds: Object.fromEntries(TIER_ORDER.map((t) => [t, Number(d.odds[t])])),
  ranges: Object.fromEntries(TIER_ORDER.map((t) => [t, Object.fromEntries(AFFIX_ORDER.map((a) => [a, d.ranges[t][a].map(Number)]))])),
  materialChance: Number(d.materialChance),
  materialQty: d.materialQty.map(Number),
  gearDropChance: Number(d.gearDropChance),
});

/** Share of each tier for a given luck %, the same formula as rollTier in shared/gear.js. */
function tierShares(odds: Record<string, string>, luck: number) {
  const boost = 1 + luck / 100;
  const weights = TIER_ORDER.map((t, i) => Math.max(0, Number(odds[t]) || 0) * boost ** i);
  const total = weights.reduce((s, w) => s + w, 0);
  return TIER_ORDER.map((t, i) => [t, total ? (weights[i] / total) * 100 : 0] as const);
}
const pct = (n: number) => `${n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

export function GearConfigTab() {
  const { data, error, loading, reload } = useLoad<{ config: GearConfig; defaults: GearConfig }>(`${ADMIN}/gear-config`);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>;

  const saved = toDraft(data.config);
  const form = draft ?? saved;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const edit = (fn: (d: Draft) => void) => {
    const next = structuredClone(form);
    fn(next);
    setDraft(next);
  };
  const rangeInput = (t: Tier, a: Affix, i: 0 | 1) => (
    <Input
      type="number"
      min={0}
      max={BONUS_CAP}
      step={1}
      className="h-8 w-16 px-2 text-right tabular-nums"
      value={form.ranges[t][a][i]}
      onChange={(e) => edit((d) => { d.ranges[t][a][i] = e.target.value; })}
      aria-label={`${AFFIXES[a].name} cấp ${TIERS[t].name} ${i ? "cao nhất" : "thấp nhất"}`}
    />
  );
  const oddsTotal = TIER_ORDER.reduce((s, t) => s + (Number(form.odds[t]) || 0), 0);

  const save = async () => {
    setBusy(true);
    try {
      await api(`${ADMIN}/gear-config`, { method: "POST", body: { config: fromDraft(form) } });
      toast.success("Đã lưu cấu hình trang phục");
      setDraft(null);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-muted-foreground" /> Tỷ lệ ra cấp khi quay đồ</span>}
          description="Áp dụng cho trang phục mua ở cửa hàng, rớt từ mini-game và mã quà để cấp ngẫu nhiên. Đây là trọng số: tổng không bắt buộc bằng 100, hệ thống tự quy ra phần trăm. May mắn của bé chính đẩy cấp cao lên, mỗi bậc nhân thêm (1 + May mắn %) một lần."
        />
        <CardBody className="space-y-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-4">
            {TIER_ORDER.map((t) => (
              <Field key={t} label={<TierDot tier={t} />} hint={`${TIERS[t].lines} dòng chỉ số`}>
                <Input type="number" min={0} max={100} step={0.1} value={form.odds[t]} onChange={(e) => edit((d) => { d.odds[t] = e.target.value; })} aria-label={`Tỷ lệ cấp ${TIERS[t].name}`} />
              </Field>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Tỷ lệ thực tế</th>
                  {TIER_ORDER.map((t) => <th key={t} className="px-3 py-2 text-right font-medium"><TierDot tier={t} className="justify-end" /></th>)}
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {[0, 20, 50, 100].map((luck) => (
                  <tr key={luck}>
                    <td className="py-1.5 pr-3 text-muted-foreground">May mắn {luck}%</td>
                    {tierShares(form.odds, luck).map(([t, share]) => <td key={t} className="px-3 py-1.5 text-right">{pct(share)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {oddsTotal <= 0 && <p role="alert" className="text-xs text-danger">Phải có ít nhất một cấp có tỷ lệ lớn hơn 0.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Shirt className="h-4 w-4 text-muted-foreground" /> Biên độ mỗi dòng chỉ số (%)</span>}
          description={`Khi quay một món, mỗi dòng nhận một số ngẫu nhiên trong khoảng [thấp nhất, cao nhất] theo cấp. Tổng mỗi loại chỉ số trên một bé không vượt ${BONUS_CAP}%. Chỉ áp dụng cho đồ quay mới; đồ đã có giữ nguyên.`}
        />
        <CardBody className="overflow-x-auto pt-3">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Cấp</th>
                {AFFIX_ORDER.map((a) => <th key={a} className="px-2 py-2 font-medium" title={AFFIXES[a].desc}>{AFFIXES[a].icon} {AFFIXES[a].name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {TIER_ORDER.map((t) => (
                <tr key={t}>
                  <td className="py-2 pr-3"><TierDot tier={t} /></td>
                  {AFFIX_ORDER.map((a) => (
                    <td key={a} className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {rangeInput(t, a, 0)}
                        <span className="text-muted-foreground">–</span>
                        {rangeInput(t, a, 1)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Gift className="h-4 w-4 text-muted-foreground" /> Phần thưởng thêm của mini-game</span>}
          description="Ngoài xu, điểm kinh nghiệm và nguyên liệu theo điểm, mỗi ván có thể rớt thêm vật liệu thô vào kho và một món trang phục. Hai tỷ lệ này nhân thêm (1 + May mắn %) của bé đang chơi."
        />
        <CardBody className="grid gap-3 pt-3 sm:grid-cols-4">
          <Field label="Tỷ lệ rớt vật liệu" hint="% mỗi ván"><Input type="number" min={0} max={100} step={0.1} value={form.materialChance} onChange={(e) => edit((d) => { d.materialChance = e.target.value; })} /></Field>
          <Field label="Số lô ít nhất" hint="mỗi lần rớt"><Input type="number" min={1} max={20} step={1} value={form.materialQty[0]} onChange={(e) => edit((d) => { d.materialQty[0] = e.target.value; })} /></Field>
          <Field label="Số lô nhiều nhất" hint="tối đa 20"><Input type="number" min={1} max={20} step={1} value={form.materialQty[1]} onChange={(e) => edit((d) => { d.materialQty[1] = e.target.value; })} /></Field>
          <Field label="Tỷ lệ rớt trang phục" hint="% mỗi ván"><Input type="number" min={0} max={100} step={0.1} value={form.gearDropChance} onChange={(e) => edit((d) => { d.gearDropChance = e.target.value; })} /></Field>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
        {dirty && <span className="mr-auto text-xs text-muted-foreground">Có thay đổi chưa lưu</span>}
        <Button variant="ghost" onClick={() => setDraft(toDraft(data.defaults))}><RotateCcw className="h-4 w-4" /> Về mặc định</Button>
        <Button variant="outline" onClick={() => setDraft(null)} disabled={!dirty}>Hoàn tác</Button>
        <Button onClick={save} loading={busy} disabled={!dirty}>Lưu cấu hình</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// A player's gear (inside the player drawer): list, give, edit, delete
// ---------------------------------------------------------------------------------------------

export interface GearView {
  id: number;
  itemId: string;
  name: string;
  slot: string | null;
  tier: string;
  affixes: Partial<Record<Affix, number>>;
  lines: string[];
  wornBy: number | null;
  listed: boolean;
  source: string;
  createdAt: number;
}
export interface Wearable {
  id: string;
  name: string;
  slot: string;
}

type AffixForm = Record<Affix, string>;
const emptyAffixes = (): AffixForm => Object.fromEntries(AFFIX_ORDER.map((a) => [a, ""])) as AffixForm;
const affixBody = (f: AffixForm) => Object.fromEntries(AFFIX_ORDER.filter((a) => f[a] !== "" && Number(f[a]) > 0).map((a) => [a, Number(f[a])]));

function AffixInputs({ value, onChange }: { value: AffixForm; onChange: (v: AffixForm) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {AFFIX_ORDER.map((a) => (
        <Field key={a} label={`${AFFIXES[a].icon} ${AFFIXES[a].name}`}>
          <Input type="number" min={0} max={BONUS_CAP} step={1} placeholder="0" value={value[a]} onChange={(e) => onChange({ ...value, [a]: e.target.value })} />
        </Field>
      ))}
    </div>
  );
}

function WearableSelect({ value, onChange, wearables, randomLabel }: { value: string; onChange: (v: string) => void; wearables: Wearable[]; randomLabel: string }) {
  const slots = Object.keys(SLOT_LABEL).filter((s) => wearables.some((w) => w.slot === s));
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Món trang phục">
      <option value="random">{randomLabel}</option>
      {slots.map((s) => (
        <optgroup key={s} label={SLOT_LABEL[s]}>
          {wearables.filter((w) => w.slot === s).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}

function TierSelect({ value, onChange, randomLabel }: { value: string; onChange: (v: string) => void; randomLabel?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Cấp">
      {randomLabel && <option value="random">{randomLabel}</option>}
      {TIER_ORDER.map((t) => <option key={t} value={t}>{TIERS[t].name} · {TIERS[t].lines} dòng</option>)}
    </Select>
  );
}

export function PlayerGear({ player, gear, wearables, pets, onChanged }: { player: { id: number; displayName: string }; gear: GearView[]; wearables: Wearable[]; pets: { id: number; name: string }[]; onChanged: () => void }) {
  const [itemId, setItemId] = useState("random");
  const [tier, setTier] = useState("random");
  const [custom, setCustom] = useState(false);
  const [affixes, setAffixes] = useState<AffixForm>(emptyAffixes);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<GearView | null>(null);
  const petName = (id: number) => pets.find((p) => p.id === id)?.name ?? `bé #${id}`;

  const grant = async () => {
    if (custom && tier === "random") return toast.error("Tự nhập chỉ số thì chọn luôn cấp");
    if (custom && !Object.keys(affixBody(affixes)).length) return toast.error("Nhập ít nhất một dòng chỉ số");
    const item = wearables.find((w) => w.id === itemId);
    setBusy(true);
    try {
      const res = await api<{ gear: GearView }>(`${ADMIN}/players/${player.id}/gear`, {
        method: "POST",
        body: { itemId, tier, affixes: custom ? affixBody(affixes) : null, playerName: player.displayName, itemName: item?.name ?? "ngẫu nhiên", tierName: tier === "random" ? "cấp quay theo tỷ lệ" : tierName(tier) },
      });
      toast.success(`Đã tặng ${res.gear.name} (${tierName(res.gear.tier)}) cho ${player.displayName}`);
      setAffixes(emptyAffixes());
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      await api(`${ADMIN}/gear/${removing.id}/delete`, { method: "POST", body: { playerName: player.displayName, itemName: removing.name } });
      toast.success(`Đã xoá ${removing.name}`);
      onChanged();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Shirt className="h-4 w-4 text-muted-foreground" /> Trang phục ({gear.length})</span>}
        description="Mỗi món có cấp Xanh lam, Xanh lục, Vàng hoặc Đỏ với 1 đến 4 dòng chỉ số. Đồ đang đeo cộng chỉ số cho bé đó."
      />
      <CardBody className="space-y-4 pt-3">
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Field label="Món"><WearableSelect value={itemId} onChange={setItemId} wearables={wearables} randomLabel="Ngẫu nhiên" /></Field>
            <Field label="Cấp"><TierSelect value={tier} onChange={setTier} randomLabel="Quay theo tỷ lệ" /></Field>
            <div className="flex items-end"><Button onClick={grant} loading={busy}><Gift className="h-4 w-4" /> Tặng</Button></div>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="h-4 w-4 accent-foreground" />
            Tự nhập dòng chỉ số (bỏ trống thì quay theo biên độ của cấp)
          </label>
          {custom && <AffixInputs value={affixes} onChange={setAffixes} />}
        </div>

        {gear.length ? (
          <div className="divide-y rounded-lg border">
            {gear.map((g) => (
              <div key={g.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{g.name}</span>
                  <TierDot tier={g.tier} />
                  <span className="text-xs text-muted-foreground">{g.slot ? SLOT_LABEL[g.slot] ?? g.slot : ""} · #{g.id} · {SOURCE_LABEL[g.source] ?? g.source}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{g.listed ? "Đang bày bán" : g.wornBy ? `${petName(g.wornBy)} đang đeo` : "Trong tủ"}</span>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(editing === g.id ? null : g.id)}>Sửa</Button>
                  <button onClick={() => setRemoving(g)} disabled={g.listed} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-danger disabled:opacity-40" aria-label={`Xoá ${g.name}`} title={g.listed ? "Đang bày bán ở Chợ Phiên" : "Xoá"}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{g.lines.join(" · ") || "Chưa có dòng chỉ số"}</p>
                {editing === g.id && <GearEditor gear={g} playerName={player.displayName} onDone={() => { setEditing(null); onChanged(); }} onCancel={() => setEditing(null)} />}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có món nào.</p>
        )}
      </CardBody>
      <ConfirmDialog open={removing !== null} onClose={() => setRemoving(null)} onConfirm={remove} title="Xoá món trang phục?" message={`${removing?.name ?? ""} (${tierName(removing?.tier ?? "")}) sẽ bị xoá khỏi tủ đồ của ${player.displayName}${removing?.wornBy ? " và tháo khỏi bé đang đeo" : ""}. Không hoàn tác được.`} confirmLabel="Xoá" danger />
    </Card>
  );
}

function GearEditor({ gear, playerName, onDone, onCancel }: { gear: GearView; playerName: string; onDone: () => void; onCancel: () => void }) {
  const [tier, setTier] = useState(gear.tier);
  const [affixes, setAffixes] = useState<AffixForm>(() => Object.fromEntries(AFFIX_ORDER.map((a) => [a, gear.affixes[a] ? String(gear.affixes[a]) : ""])) as AffixForm);
  const [busy, setBusy] = useState(false);
  const lines = Object.keys(affixBody(affixes)).length;
  const expected = (TIERS as Record<string, { lines: number }>)[tier]?.lines ?? 0;
  const save = async () => {
    if (!lines) return toast.error("Cần ít nhất một dòng chỉ số");
    setBusy(true);
    try {
      await api(`${ADMIN}/gear/${gear.id}`, { method: "POST", body: { tier, affixes: affixBody(affixes), playerName, itemName: gear.name } });
      toast.success(`Đã cập nhật ${gear.name}`);
      onDone();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label="Cấp"><TierSelect value={tier} onChange={setTier} /></Field>
        <p className="self-end pb-2 text-xs text-muted-foreground">
          Cấp {tierName(tier)} thường có {expected} dòng; đang nhập {lines} dòng. Ô trống hoặc 0 là bỏ dòng đó.
        </p>
      </div>
      <AffixInputs value={affixes} onChange={setAffixes} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Huỷ</Button>
        <Button size="sm" onClick={save} loading={busy}>Lưu</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Gift codes: create (one custom code or a batch of random ones), list, redemptions, revoke
// ---------------------------------------------------------------------------------------------

interface GiftCode {
  id: number;
  code: string;
  label: string;
  rewardsText: string;
  maxUses: number | null;
  uses: number;
  expiresAt: number | null;
  createdBy: string;
  createdAt: number;
  revokedAt: number | null;
  usable: boolean;
}
interface GiftData {
  codes: GiftCode[];
  items: { id: string; name: string; icon: string; type: string }[];
  wearables: Wearable[];
}
const ITEM_TYPE_LABEL: Record<string, string> = { food: "Đồ ăn", care: "Chăm sóc", toy: "Đồ chơi", egg: "Trứng", tool: "Dụng cụ", seed: "Hạt giống" };

async function copyText(text: string, done = "Đã chép") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Không chép được, hãy chọn và sao chép thủ công");
  }
}

export function GiftCodesTab() {
  const { data, error, loading, reload } = useLoad<GiftData>(`${ADMIN}/gift-codes`);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [count, setCount] = useState("1");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [coinsText, setCoinsText] = useState("");
  const [items, setItems] = useState<{ id: string; qty: string }[]>([]);
  const [gear, setGear] = useState<{ itemId: string; tier: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<GiftCode[] | null>(null);
  const [revoking, setRevoking] = useState<GiftCode | null>(null);
  const [viewing, setViewing] = useState<GiftCode | null>(null);
  const itemTypes = useMemo(() => [...new Set((data?.items ?? []).map((i) => i.type))], [data]);
  const batch = Number(count) > 1;

  const create = async () => {
    const rewards = {
      coins: coinsText ? Number(coinsText) : 0,
      items: Object.fromEntries(items.filter((i) => i.id).map((i) => [i.id, Number(i.qty) || 1])),
      gear,
    };
    setBusy(true);
    try {
      const res = await api<{ codes: GiftCode[] }>(`${ADMIN}/gift-codes`, {
        method: "POST",
        body: { label, code: batch ? null : code.trim() || null, count: Number(count) || 1, maxUses: maxUses || null, expiresAt: expires ? new Date(`${expires}T23:59:59`).getTime() : null, rewards },
      });
      setMade(res.codes);
      toast.success(res.codes.length > 1 ? `Đã tạo ${res.codes.length} mã quà` : `Đã tạo mã ${res.codes[0].code}`);
      setCode("");
      reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (!revoking) return;
    try {
      await api(`${ADMIN}/gift-codes/${revoking.id}/revoke`, { method: "POST", body: {} });
      toast.success(`Đã thu hồi mã ${revoking.code}`);
      reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Ticket className="h-4 w-4 text-muted-foreground" /> Tạo mã quà</span>}
          description="Người chơi nhập mã ở menu tài khoản (bấm vào tên mình trong game). Mỗi người nhận một mã một lần; giới hạn lượt là tổng số người được nhận mỗi mã."
        />
        <CardBody className="space-y-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_7rem_8rem_11rem]">
            <Field label="Nhãn" hint="người chơi thấy khi nhận"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Quà Tết 2027" maxLength={60} /></Field>
            <Field label="Mã" hint={batch ? "tạo nhiều mã thì tự sinh" : "trống = tự sinh"}>
              <Input value={batch ? "" : code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TET2027" maxLength={32} disabled={batch} className="font-mono uppercase" />
            </Field>
            <Field label="Số mã" hint="1–200"><Input type="number" min={1} max={200} step={1} value={count} onChange={(e) => setCount(e.target.value)} /></Field>
            <Field label="Lượt mỗi mã" hint="trống = không giới hạn"><Input type="number" min={1} max={100000} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="∞" /></Field>
            <Field label="Hạn dùng" hint="trống = vô thời hạn"><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Phần quà</p>
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <Field label="Xu"><Input type="number" min={0} max={1000000} step={1} value={coinsText} onChange={(e) => setCoinsText(e.target.value)} placeholder="0" /></Field>
            </div>
            {items.map((row, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_7rem_auto]">
                <Field label={i === 0 ? "Vật phẩm" : undefined}>
                  <Select value={row.id} onChange={(e) => setItems(items.map((r, j) => (j === i ? { ...r, id: e.target.value } : r)))} aria-label="Vật phẩm">
                    <option value="">Chọn vật phẩm…</option>
                    {itemTypes.map((type) => (
                      <optgroup key={type} label={ITEM_TYPE_LABEL[type] ?? type}>
                        {data?.items.filter((it) => it.type === type).map((it) => <option key={it.id} value={it.id}>{it.icon} {it.name}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label={i === 0 ? "Số lượng" : undefined}><Input type="number" min={1} max={99} value={row.qty} onChange={(e) => setItems(items.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))} aria-label="Số lượng" /></Field>
                <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Bỏ vật phẩm"><X className="h-4 w-4" /></Button>
              </div>
            ))}
            {gear.map((row, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_12rem_auto]">
                <Field label={i === 0 ? "Trang phục" : undefined}><WearableSelect value={row.itemId} onChange={(v) => setGear(gear.map((r, j) => (j === i ? { ...r, itemId: v } : r)))} wearables={data?.wearables ?? []} randomLabel="Món ngẫu nhiên" /></Field>
                <Field label={i === 0 ? "Cấp" : undefined}><TierSelect value={row.tier} onChange={(v) => setGear(gear.map((r, j) => (j === i ? { ...r, tier: v } : r)))} randomLabel="Quay theo tỷ lệ" /></Field>
                <Button variant="ghost" size="sm" onClick={() => setGear(gear.filter((_, j) => j !== i))} aria-label="Bỏ trang phục"><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: "", qty: "1" }])}><Plus className="h-4 w-4" /> Vật phẩm</Button>
              <Button variant="outline" size="sm" onClick={() => setGear([...gear, { itemId: "random", tier: "random" }])} disabled={gear.length >= 10}><Plus className="h-4 w-4" /> Trang phục</Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={create} loading={busy}><Ticket className="h-4 w-4" /> {batch ? `Tạo ${Number(count)} mã` : "Tạo mã"}</Button>
          </div>

          {made && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{made.length > 1 ? `${made.length} mã vừa tạo` : "Mã vừa tạo"} · {made[0].rewardsText}</p>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => copyText(made.map((m) => m.code).join("\n"), made.length > 1 ? `Đã chép ${made.length} mã` : "Đã chép mã")}><Copy className="h-4 w-4" /> Chép {made.length > 1 ? "tất cả" : ""}</Button>
                <Button size="sm" variant="ghost" onClick={() => setMade(null)} aria-label="Đóng"><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {made.map((m) => <code key={m.id} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{m.code}</code>)}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {error ? (
        <Failure error={error} onRetry={reload} />
      ) : (
        <Card className="overflow-hidden">
          {loading && !data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : data?.codes.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Mã</th>
                    <th className="px-3 py-2.5 font-medium">Nhãn · phần quà</th>
                    <th className="px-3 py-2.5 text-right font-medium">Đã nhận</th>
                    <th className="px-3 py-2.5 font-medium">Hạn</th>
                    <th className="px-3 py-2.5 font-medium">Tạo bởi</th>
                    <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.codes.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{c.code}</code>
                          <button onClick={() => copyText(c.code, "Đã chép mã")} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Chép mã ${c.code}`}><Copy className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><span className="font-medium">{c.label}</span><span className="block text-xs text-muted-foreground">{c.rewardsText}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.expiresAt ? when(c.expiresAt) : "Vô thời hạn"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.createdBy} · {when(c.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {c.uses > 0 && <Button size="sm" variant="ghost" onClick={() => setViewing(c)}><Users className="h-4 w-4" /> Ai đã nhận</Button>}
                          {c.revokedAt ? (
                            <span className="text-xs text-muted-foreground">Đã thu hồi</span>
                          ) : c.usable ? (
                            <Button size="sm" variant="ghost" onClick={() => setRevoking(c)}>Thu hồi</Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Hết lượt hoặc hết hạn</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Ticket} title="Chưa có mã quà nào" description="Tạo mã ở trên rồi gửi cho người chơi." />
          )}
        </Card>
      )}
      <ConfirmDialog open={revoking !== null} onClose={() => setRevoking(null)} onConfirm={revoke} title="Thu hồi mã quà?" message={`Mã ${revoking?.code ?? ""} sẽ không nhận thêm được nữa. Quà đã trao vẫn giữ nguyên.`} confirmLabel="Thu hồi" danger />
      <Redemptions code={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Redemptions({ code, onClose }: { code: GiftCode | null; onClose: () => void }) {
  return (
    <Modal open={code !== null} onClose={onClose} title={`Người đã nhận mã ${code?.code ?? ""}`} description={code?.rewardsText}>
      {code && <RedemptionList id={code.id} />}
    </Modal>
  );
}

function RedemptionList({ id }: { id: number }) {
  const { data, error, loading, reload } = useLoad<{ redemptions: { userId: number; name: string; at: number }[] }>(`${ADMIN}/gift-codes/${id}`);
  if (error) return <Failure error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>;
  if (!data.redemptions.length) return <p className="text-sm text-muted-foreground">Chưa ai nhận.</p>;
  return (
    <ul className="max-h-80 divide-y overflow-y-auto text-sm">
      {data.redemptions.map((r) => (
        <li key={r.userId} className="flex justify-between gap-3 py-2">
          <span>{r.name}</span>
          <span className="text-xs text-muted-foreground">{when(r.at)}</span>
        </li>
      ))}
    </ul>
  );
}
