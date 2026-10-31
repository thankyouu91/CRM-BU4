#!/usr/bin/env node
// Rig 2.0 wearables: turn the wear artists' JSON stamps into the game's data modules (no dependencies).
//
//   node scripts/art/build-wear.mjs SRC            build: write public/ta-tua/game/js/rig2/wear/data/<slot>.js
//   node scripts/art/build-wear.mjs SRC --check    validate SRC and fail if the committed modules differ from it
//   node scripts/art/build-wear.mjs --check        validate the committed modules alone (no art folder needed)
//
// SRC (required to build) is the art team's working folder that holds wear-head/, wear-face/, wear-neck/, wear-back/
// and wear-charm/, each with data/<id>.json in the WEAR-SPEC format (phase2/pets in the scratchpad). The script only
// READS there. The five modules it writes are generated files: commit them, never edit them by hand.
//
// Checks (any failure exits 1 and writes nothing):
//   - every WEARABLES id of shared/pets.js is present exactly once, in its own slot folder; no unknown ids or files;
//   - every key is one character, every colour is in core.js PALETTE, and no key is the outline colour #2e1d14
//     (the renderer draws the outer outline; a hand-drawn one would double it);
//   - views S, E, N present (S and E never null: every item must show to the park's walkers); "small" for every back
//     item (baby/kid), "big" for every face item (big-eye stages), no "big" outside face, no "small" in face;
//   - rows are rectangular and use only their item's keys; every pivot is a pixel inside its rows;
//   - "layer" is front | behind | behindNfront; "over" (WEAR-SPEC D1) only on back views; "earsOver" only on head items;
//   - the flutter rows (WEAR-SPEC D3, named in the neck report) exist in the item's E rows.
// Output is deterministic: items sorted by id, fixed layout, so a rebuild from the same JSON gives the same bytes.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const GAME = join(REPO, "public/ta-tua/game/js");
export const OUT_DIR = join(GAME, "rig2/wear/data");
export const SLOTS = ["head", "face", "neck", "back", "charm"];
const VIEWS = ["S", "E", "N"];
const LAYERS = ["front", "behind", "behindNfront"];
const DEFAULT_LAYER = { head: "front", face: "front", neck: "front", back: "behindNfront", charm: "front" };
const TOP_KEYS = new Set(["id", "slot", "keys", "views", "small", "big", "layer", "notes", "earsOver"]);

/**
 * WEAR-SPEC D3: the E rows (0-based, inclusive) that the renderer shifts by pose.flutter, per variant. The artists name
 * them in the item notes and in wear-neck/report.txt ("scarf E rows 3-5 (small E rows 3-4), leafscarf E rows 3-7
 * (small E rows 3-5)"); they are copied here so the game reads numbers, not prose.
 */
const FLUTTER = {
  scarf: { views: [3, 5], small: [3, 4] },
  leafscarf: { views: [3, 7], small: [3, 5] },
};
/** wear-head/report.txt "JUMP": the halo trails the head by up to this many px when the pet jumps (floats). */
const LAG = { halo: 3 };

const { WEARABLES } = await import(pathToFileURL(join(GAME, "shared/pets.js")).href);
const { PALETTE, INK } = await import(pathToFileURL(join(GAME, "rig2/core.js")).href);
const PAL = new Set(PALETTE);

/** Validate one item (parsed JSON) of slot `slot`; returns a list of problems (empty = fine). */
export function validateItem(slot, d, file = d?.id) {
  const errs = [];
  const err = (m) => errs.push(`${slot}/${file}: ${m}`);
  if (!d || typeof d !== "object") return [`${slot}/${file}: not an object`];
  for (const k of Object.keys(d)) if (!TOP_KEYS.has(k)) err(`unknown key "${k}"`);
  if (d.slot !== slot) err(`slot "${d.slot}" is not "${slot}"`);
  if (WEARABLES[d.id]?.slot !== slot) err(`id "${d.id}" is not a ${slot} item in shared/pets.js WEARABLES`);
  const keys = d.keys ?? {};
  for (const [k, c] of Object.entries(keys)) {
    if (k.length !== 1 || k === "." || k === " " || k === "'" || k === "\\") err(`bad key ${JSON.stringify(k)}`);
    if (typeof c !== "string" || !PAL.has(c.toLowerCase())) err(`key ${k} = ${c} is not in the palette`);
    else if (c.toLowerCase() === INK) err(`key ${k} is the outline colour ${INK} (the renderer draws the outline)`);
  }
  const layer = d.layer ?? DEFAULT_LAYER[slot];
  if (!LAYERS.includes(layer)) err(`layer "${layer}" is not one of ${LAYERS.join(", ")}`);
  if ("earsOver" in d && (slot !== "head" || typeof d.earsOver !== "boolean")) err(`earsOver is a boolean for head items only`);
  const checkView = (where, v) => {
    if (!v || !Array.isArray(v.rows) || !v.rows.length) return err(`${where}: no rows`);
    const w = v.rows[0].length;
    if (!w) err(`${where}: empty rows`);
    v.rows.forEach((r, j) => {
      if (typeof r !== "string" || r.length !== w) err(`${where}: row ${j} is ${r?.length} px wide, not ${w} (ragged)`);
      for (const ch of r ?? "") if (ch !== "." && ch !== " " && !(ch in keys)) err(`${where}: unknown key ${JSON.stringify(ch)} in row ${j}`);
    });
    const [px, py] = v.pivot ?? [];
    if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= w || py >= v.rows.length) {
      err(`${where}: pivot ${JSON.stringify(v.pivot)} is not a pixel inside the ${w}x${v.rows.length} rows`);
    }
    for (const k of Object.keys(v)) if (!["rows", "pivot", "over"].includes(k)) err(`${where}: unknown key "${k}"`);
    if (v.over) {
      if (slot !== "back") err(`${where}: "over" is for back items only (WEAR-SPEC D1)`);
      else checkView(`${where}.over`, { ...v.over, over: undefined });
    }
  };
  const variants = ["views", ...(slot === "face" ? ["big"] : ["small"])];
  if (slot === "face" && d.small) err(`face items use "big", not "small"`);
  if (slot !== "face" && d.big) err(`"big" is for face items only`);
  if (slot === "back" && !d.small) err(`back items need "small" (baby/kid)`);
  if (slot === "face" && !d.big) err(`face items need "big" (big-eye stages)`);
  for (const vn of variants) {
    const set = d[vn];
    if (!set) continue;
    for (const v of VIEWS) {
      if (!(v in set)) err(`${vn}.${v} missing (use null only for a view where the item cannot be seen)`);
      else if (set[v] === null) {
        if (v !== "N") err(`${vn}.${v} is null: every item must show in S and E`);
      } else checkView(`${vn}.${v}`, set[v]);
    }
    for (const v of Object.keys(set)) if (!VIEWS.includes(v)) err(`${vn}: unknown view "${v}" (W is the mirrored E)`);
  }
  const fl = FLUTTER[d.id];
  if (fl) {
    for (const [vn, [a, b]] of Object.entries(fl)) {
      const n = d[vn]?.E?.rows?.length ?? 0;
      if (!(a >= 0 && a <= b && b < n)) err(`flutter rows ${a}-${b} are outside ${vn}.E (${n} rows)`);
    }
  }
  return errs;
}

/** Read and validate the five folders under `src`: { items: { slot: { id: json } }, errors: [...] }. */
export function readSource(src) {
  const items = Object.fromEntries(SLOTS.map((s) => [s, {}]));
  const errors = [];
  for (const slot of SLOTS) {
    const dir = join(src, `wear-${slot}`, "data");
    if (!existsSync(dir)) {
      errors.push(`missing folder ${dir}`);
      continue;
    }
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const id = f.slice(0, -5);
      let d;
      try {
        d = JSON.parse(readFileSync(join(dir, f), "utf8"));
      } catch (e) {
        errors.push(`${slot}/${f}: ${e.message}`);
        continue;
      }
      if (d.id !== id) errors.push(`${slot}/${f}: id "${d.id}" does not match the file name`);
      errors.push(...validateItem(slot, d, f));
      items[slot][id] = d;
    }
  }
  errors.push(...coverage(items));
  return { items, errors };
}

/** Every WEARABLES id exactly once, in its own slot. */
function coverage(items) {
  const errs = [];
  const seen = new Map();
  for (const slot of SLOTS) {
    for (const id of Object.keys(items[slot])) {
      if (seen.has(id)) errs.push(`${id}: present in both ${seen.get(id)} and ${slot}`);
      seen.set(id, slot);
    }
  }
  for (const [id, w] of Object.entries(WEARABLES)) {
    if (!seen.has(id)) errs.push(`${id}: no data (expected wear-${w.slot}/data/${id}.json)`);
    else if (seen.get(id) !== w.slot) errs.push(`${id}: found in ${seen.get(id)}, but WEARABLES says ${w.slot}`);
  }
  return errs;
}

// ---------------------------------------------------------------- output

/** The runtime record of one item: only what the renderer reads (notes stay in the art package). */
function runtimeItem(slot, d) {
  const view = (v, vn, name) => {
    if (v === null) return null;
    const out = { pivot: [...v.pivot], rows: [...v.rows] };
    if (v.over) out.over = { pivot: [...v.over.pivot], rows: [...v.over.rows] };
    if (name === "E" && FLUTTER[d.id]?.[vn]) out.flutter = [...FLUTTER[d.id][vn]];
    return out;
  };
  const set = (vn) => (d[vn] ? Object.fromEntries(VIEWS.map((v) => [v, view(d[vn][v], vn, v)])) : undefined);
  const out = { layer: d.layer ?? DEFAULT_LAYER[slot] };
  if (d.earsOver) out.earsOver = true;
  if (LAG[d.id]) out.lag = LAG[d.id];
  out.keys = Object.fromEntries(Object.entries(d.keys).map(([k, c]) => [k, c.toLowerCase()]));
  out.views = set("views");
  if (d.small) out.small = set("small");
  if (d.big) out.big = set("big");
  return out;
}

const q = (s) => `'${s}'`;
function viewText(v, ind) {
  if (v === null) return "null";
  const pad = " ".repeat(ind);
  const lines = ["{", `${pad}  pivot: [${v.pivot.join(", ")}],`];
  if (v.flutter) lines.push(`${pad}  flutter: [${v.flutter.join(", ")}],`);
  lines.push(`${pad}  rows: [`, ...v.rows.map((r) => `${pad}    ${q(r)},`), `${pad}  ],`);
  if (v.over) lines.push(`${pad}  over: ${viewText(v.over, ind + 2)},`);
  lines.push(`${pad}}`);
  return lines.join("\n");
}

/** Text of the generated module for one slot (deterministic). */
export function moduleText(slot, items) {
  const ids = Object.keys(items).sort();
  const out = [
    `// GENERATED by scripts/art/build-wear.mjs from the wear-${slot} art package. Do not edit by hand:`,
    "// change the artist's JSON (wear-<slot>/data/<id>.json, WEAR-SPEC format) and run",
    "//   node scripts/art/build-wear.mjs <art folder>",
    "// Each item: layer, keys (one character -> palette colour), views { S, E, N } (+ small for baby/kid, big for the",
    "// big-eye face stages): rows drawn WITHOUT the outer outline, pivot = the pixel that lands on the slot anchor.",
    "// N may be null (the item cannot be seen from behind). W is the mirrored E frame. Rules: rig2/wear/stamp.js.",
    "export default {",
  ];
  for (const id of ids) {
    const it = runtimeItem(slot, items[id]);
    out.push(`  ${id}: {`, `    layer: ${q(it.layer)},`);
    if (it.earsOver) out.push("    earsOver: true,");
    if (it.lag) out.push(`    lag: ${it.lag},`);
    out.push(`    keys: { ${Object.entries(it.keys).map(([k, c]) => `${/^[A-Za-z_$]$/.test(k) ? k : q(k)}: ${q(c)}`).join(", ")} },`);
    for (const vn of ["views", "small", "big"]) {
      if (!it[vn]) continue;
      out.push(`    ${vn}: {`);
      for (const v of VIEWS) out.push(`      ${v}: ${viewText(it[vn][v], 6)},`);
      out.push("    },");
    }
    out.push("  },");
  }
  out.push("};", "");
  return out.join("\n");
}

const modulePath = (slot) => join(OUT_DIR, `${slot}.js`);

/** Load the committed modules back as { slot: { id: runtime item } } (for --check without a source folder). */
async function readModules() {
  const items = {};
  for (const slot of SLOTS) {
    const p = modulePath(slot);
    items[slot] = existsSync(p) ? (await import(`${pathToFileURL(p).href}?t=${Date.now()}`)).default : {};
  }
  return items;
}

/** A runtime item back in the JSON shape (so the same validator runs on the committed modules). */
function asSource(slot, id, it) {
  const back = (set) => (set ? Object.fromEntries(VIEWS.map((v) => [v, set[v] && { rows: set[v].rows, pivot: set[v].pivot, ...(set[v].over ? { over: set[v].over } : {}) }])) : undefined);
  const d = { id, slot, keys: it.keys, views: back(it.views), layer: it.layer };
  if (it.small) d.small = back(it.small);
  if (it.big) d.big = back(it.big);
  if (it.earsOver) d.earsOver = true;
  return d;
}

async function main(argv) {
  const check = argv.includes("--check");
  const src = argv.find((a) => !a.startsWith("--"));
  if (!src && !check) {
    console.error("usage: node scripts/art/build-wear.mjs SRC [--check]   (SRC = folder with wear-<slot>/data/*.json)");
    return 2;
  }
  let items;
  const errors = [];
  if (src) {
    const r = readSource(resolve(src));
    items = r.items;
    errors.push(...r.errors);
  } else {
    const mods = await readModules();
    items = Object.fromEntries(SLOTS.map((s) => [s, Object.fromEntries(Object.entries(mods[s]).map(([id, it]) => [id, asSource(s, id, it)]))]));
    for (const s of SLOTS) for (const [id, d] of Object.entries(items[s])) errors.push(...validateItem(s, d, id));
    errors.push(...coverage(items));
    // Canonical form: the committed text is exactly what the builder writes for that data.
    for (const s of SLOTS) {
      const want = moduleText(s, items[s]);
      if (existsSync(modulePath(s)) && readFileSync(modulePath(s), "utf8") !== want) errors.push(`${modulePath(s)}: not in the builder's canonical form (rebuild it)`);
    }
  }
  if (errors.length) {
    for (const e of errors) console.error(`  ${e}`);
    console.error(`build-wear: ${errors.length} problem(s); nothing written.`);
    return 1;
  }
  let stale = 0;
  for (const slot of SLOTS) {
    const n = Object.keys(items[slot]).length;
    if (!src) {
      console.log(`ok   ${slot.padEnd(5)} ${String(n).padStart(2)} items  ${modulePath(slot)}`);
      continue;
    }
    const text = moduleText(slot, items[slot]);
    const cur = existsSync(modulePath(slot)) ? readFileSync(modulePath(slot), "utf8") : null;
    if (check) {
      const same = cur === text;
      if (!same) stale++;
      console.log(`${same ? "ok   " : "STALE"} ${slot.padEnd(5)} ${String(n).padStart(2)} items  ${modulePath(slot)}`);
    } else {
      if (cur !== text) writeFileSync(modulePath(slot), text);
      console.log(`${cur === text ? "same " : "wrote"} ${slot.padEnd(5)} ${String(n).padStart(2)} items  ${modulePath(slot)}`);
    }
  }
  if (stale) {
    console.error(`build-wear --check: ${stale} module(s) differ from the art folder; run the build and commit.`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
