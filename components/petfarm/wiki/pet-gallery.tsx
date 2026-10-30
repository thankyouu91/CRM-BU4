"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ELEMENTS, LEVEL_FORMS, LIFE_STAGES, MASCOTS, RARITIES, SPECIES, speciesStats } from "@/public/ta-tua/game/js/shared/pets.js";
import { SKILLS } from "@/petdex/server/rules/careers.js";
import { PetPortrait } from "./pet-portrait";

// Every species of the game, read from shared/pets.js and drawn live: filter by element and rarity,
// pick one to see it at every age stage and every level form. "#be-<id>" opens a pet directly.

type Species = { id: string; name: string; element: string; rarity: string; fav: string; description?: string };
type Named = { name: string; icon?: string };
const elements = ELEMENTS as Record<string, Named & { color: string }>;
const rarities = RARITIES as Record<string, { name: string; stars: number; color: string; lifespan: number }>;
const skills = SKILLS as Record<string, Named>;
const stages = LIFE_STAGES as { key: string; name: string; fromWeek: number }[];
const forms = LEVEL_FORMS as { from: number; name: string }[];
const ALL: Species[] = [...(MASCOTS as Species[]), ...(SPECIES as Species[])];
const RARITY_ORDER = Object.keys(rarities);

const stars = (r: string) => "★".repeat(rarities[r].stars);
const howToGet = (s: Species) => (s.rarity === "thuong" ? "Nhận nuôi ngay hoặc nở từ trứng" : `Chỉ nở từ Trứng ${elements[s.element].name}`);

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border-2 px-3 py-1 text-[15px] font-bold transition-colors",
        on ? "border-[var(--pf-accent)] bg-[var(--pf-accent)] text-[var(--pf-button-ink)]" : "border-[var(--pf-line)] bg-[var(--pf-surface)] hover:border-[var(--pf-accent)]",
      )}
    >
      {children}
    </button>
  );
}

function Detail({ sp }: { sp: Species }) {
  const st = useMemo(() => speciesStats(sp) as { skills: Record<string, number>; lifespan: number }, [sp]);
  return (
    <div className="rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex justify-center rounded-[18px] bg-[var(--pf-surface-2)] p-3">
          <PetPortrait id={sp.id} stage="adult" level={1} animate scale={4} label={`${sp.name}, trưởng thành`} />
        </div>
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--pf-display)] text-3xl font-extrabold">{sp.name}</h3>
          <p className="mt-1 font-bold" style={{ color: rarities[sp.rarity].color }}>
            {stars(sp.rarity)} {rarities[sp.rarity].name} · {elements[sp.element].icon} Hành {elements[sp.element].name}
          </p>
          {sp.description && <p className="mt-2 text-[var(--pf-muted)]">{sp.description}</p>}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
            <dt className="font-bold">Sở trường</dt>
            <dd>{skills[sp.fav].icon} {skills[sp.fav].name}</dd>
            <dt className="font-bold">Kỹ năng khởi đầu</dt>
            <dd>{Object.entries(st.skills).map(([k, v]) => `${skills[k].icon} ${v}`).join(" · ")}</dd>
            <dt className="font-bold">Tuổi thọ gốc</dt>
            <dd>khoảng {st.lifespan} tuần (chăm tốt thì sống lâu hơn)</dd>
            <dt className="font-bold">Cách có</dt>
            <dd>{howToGet(sp)}</dd>
          </dl>
        </div>
      </div>
      <h4 className="mt-6 font-[family-name:var(--pf-display)] text-lg font-extrabold">Lớn lên theo tuổi</h4>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {stages.map((s) => (
          <li key={s.key} className="flex shrink-0 flex-col items-center rounded-[14px] bg-[var(--pf-surface-2)] px-2 pb-2 pt-1">
            <PetPortrait id={sp.id} stage={s.key} level={1} scale={2} label={`${sp.name}, ${s.name}`} />
            <span className="text-sm font-bold">{s.name}</span>
            <span className="text-xs text-[var(--pf-muted)]">từ tuần {s.fromWeek}</span>
          </li>
        ))}
      </ul>
      <h4 className="mt-4 font-[family-name:var(--pf-display)] text-lg font-extrabold">Dáng theo cấp</h4>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {forms.map((f) => (
          <li key={f.from} className="flex shrink-0 flex-col items-center rounded-[14px] bg-[var(--pf-surface-2)] px-2 pb-2 pt-1">
            <PetPortrait id={sp.id} stage="adult" level={f.from} scale={2} label={`${sp.name}, dáng ${f.name}`} />
            <span className="text-sm font-bold">{f.name}</span>
            <span className="text-xs text-[var(--pf-muted)]">từ cấp {f.from}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The whole species catalogue, with filters and a detail panel. */
export function PetGallery() {
  const [element, setElement] = useState<string | null>(null);
  const [rarity, setRarity] = useState<string | null>(null);
  const [picked, setPicked] = useState<string>(ALL.find((s) => s.rarity === "huyenthoai")?.id ?? ALL[0].id);
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.replace(/^#be-/, ""));
      if (ALL.some((s) => s.id === id)) setPicked(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const shown = ALL.filter((s) => (!element || s.element === element) && (!rarity || s.rarity === rarity)).sort(
    (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity),
  );
  const sp = ALL.find((s) => s.id === picked)!;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo hành">
        <span className="mr-1 text-[15px] font-bold text-[var(--pf-muted)]">Hành</span>
        <Chip on={!element} onClick={() => setElement(null)}>Tất cả</Chip>
        {Object.entries(elements).map(([k, e]) => (
          <Chip key={k} on={element === k} onClick={() => setElement(element === k ? null : k)}>{e.icon} {e.name}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo độ hiếm">
        <span className="mr-1 text-[15px] font-bold text-[var(--pf-muted)]">Độ hiếm</span>
        <Chip on={!rarity} onClick={() => setRarity(null)}>Tất cả</Chip>
        {RARITY_ORDER.map((r) => (
          <Chip key={r} on={rarity === r} onClick={() => setRarity(rarity === r ? null : r)}>{stars(r)} {rarities[r].name}</Chip>
        ))}
      </div>
      <p className="text-[15px] text-[var(--pf-muted)]">{shown.length} bé. Bấm vào một bé để xem các giai đoạn và các dáng.</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((s) => (
          <li key={s.id}>
            <a
              href={`#be-${s.id}`}
              onClick={() => setPicked(s.id)}
              aria-current={s.id === picked ? "true" : undefined}
              className={cn(
                "flex h-full flex-col items-center rounded-[16px] border-2 bg-[var(--pf-surface)] px-1 pb-2 pt-1 text-center transition-transform hover:-translate-y-0.5",
                s.id === picked ? "border-[var(--pf-accent)]" : "border-[var(--pf-line)]",
              )}
            >
              <PetPortrait id={s.id} stage="adult" scale={1.6} label={s.name} />
              <span className="text-sm font-extrabold leading-tight">{s.name}</span>
              <span className="text-xs font-bold" style={{ color: rarities[s.rarity].color }}>
                {elements[s.element].icon} {stars(s.rarity)}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div id={`be-${sp.id}`} className="scroll-mt-24">
        <Detail sp={sp} />
      </div>
    </div>
  );
}

/** A row of pets with captions, for an article. */
export function PetRow({ items }: { items: { id: string; stage?: string; level?: number; label: string; sub?: string }[] }) {
  return (
    <ul className="flex gap-3 overflow-x-auto pb-2">
      {items.map((it) => (
        <li key={`${it.id}-${it.stage}-${it.level}-${it.label}`} className="flex shrink-0 flex-col items-center rounded-[16px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] px-2 pb-2 pt-1 text-center">
          <PetPortrait id={it.id} stage={it.stage} level={it.level} animate scale={2.2} label={`${it.label}${it.sub ? `, ${it.sub}` : ""}`} />
          <span className="text-sm font-extrabold">{it.label}</span>
          {it.sub && <span className="text-xs text-[var(--pf-muted)]">{it.sub}</span>}
        </li>
      ))}
    </ul>
  );
}
