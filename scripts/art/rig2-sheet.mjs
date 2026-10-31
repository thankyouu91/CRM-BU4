#!/usr/bin/env node
// Rig 2.0 contact sheets for pet artists: check your part/ramp/wear changes without a browser.
//
//   node scripts/art/rig2-sheet.mjs [--out DIR] [--scale N] [--only stages,dirs,wear,strip] [--species id,id] [--level N]
//
// Writes PNGs (default DIR = ./rig2-sheets, scale 2):
//   rig2-stages.png      all 51 species x 6 life stages, front view (S), idle frame 0
//   rig2-dirs.png        all 51 adults x 4 directions (S, E, N, W), idle frame 0, plus walk frame 1 in E
//   rig2-wear.png        every wearable on 3 body plans (boba biped, meo_bac quad, canh_cut bird) + a baby boba x 3 views (S, E, N);
//                        --wear-species a,b,c uses those adults + a baby of the first instead
//   rig2-strip-<id>.png  with --species: every animation x direction for each listed species (one row per anim-dir)
//   rig2-wear-<slot>.png with --only items (one sheet per wear slot): every item x boba / meo_bac / canh_cut / tho_la
//                        x S E N W, an adult row and a baby row, plus the item's bag icon (wearIcon) at 1x and 3x;
//                        --pose walk1 draws walk frame 1 (hop + scarf flutter), --ids a,b limits the items,
//                        --wear-species a,b,c replaces the four bodies (e.g. add a round and a serpent species);
//                        the flag also applies to the default rig2-wear.png sheet
// Cells are 48x48 on a cream card; a red cell border marks a frame that breaks the rules (off-palette pixel,
// semi-transparent pixel, or a pixel touching the cell edge). Labels are a tiny 3x5 pixel font.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { encodePng } from "./png.mjs";

const GAME = new URL("../../public/ta-tua/game/js/", import.meta.url);
const { LIFE_STAGES, MASCOTS, SPECIES, WEARABLES } = await import(new URL("shared/pets.js", GAME));
const rig = await import(new URL("rig2/index.js", GAME));

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = resolve(opt("out", "rig2-sheets"));
const SCALE = Math.max(1, Number(opt("scale", 2)));
const LEVEL = Math.max(1, Number(opt("level", 1)));
const STRIP = opt("species", "") ? opt("species", "").split(",") : [];
const ONLY = opt("only", STRIP.length ? "strip" : "stages,dirs,wear").split(",");
const IDS = opt("ids", "") ? opt("ids", "").split(",") : null;
const POSE = opt("pose", "idle0");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- canvas
const CREAM = [0xfb, 0xf1, 0xe3];
const CARD = [0xff, 0xfa, 0xf3];
const INKC = [0x2e, 0x1d, 0x14];
const RED = [0xe8, 0x4a, 0x5f];
const MUTED = [0x9b, 0x62, 0x38];

function canvas(w, h, bg = CREAM) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...bg, 255], i * 4);
  return { w, h, data };
}
function fill(c, x, y, w, h, rgb) {
  for (let j = Math.max(0, y); j < Math.min(c.h, y + h); j++) {
    for (let i = Math.max(0, x); i < Math.min(c.w, x + w); i++) c.data.set([...rgb, 255], (j * c.w + i) * 4);
  }
}
function frameAt(c, img, x, y, s = SCALE) {
  for (let j = 0; j < img.h; j++) {
    for (let i = 0; i < img.w; i++) {
      const k = (j * img.w + i) * 4;
      if (!img.data[k + 3]) continue;
      fill(c, x + i * s, y + j * s, s, s, [img.data[k], img.data[k + 1], img.data[k + 2]]);
    }
  }
}
function box(c, x, y, w, h, rgb) {
  fill(c, x, y, w, 1, rgb);
  fill(c, x, y + h - 1, w, 1, rgb);
  fill(c, x, y, 1, h, rgb);
  fill(c, x + w - 1, y, 1, h, rgb);
}

// 3x5 pixel font (lowercase, digits, a few marks).
const FONT = {
  a: "010101111101101", b: "110101110101110", c: "011100100100011", d: "110101101101110", e: "111100110100111",
  f: "111100110100100", g: "011100101101011", h: "101101111101101", i: "111010010010111", j: "001001001101010",
  k: "101101110101101", l: "100100100100111", m: "101111111101101", n: "110101101101101", o: "010101101101010",
  p: "110101110100100", q: "010101101011001", r: "110101110101101", s: "011100010001110", t: "111010010010010",
  u: "101101101101111", v: "101101101101010", w: "101101111111101", x: "101101010101101", y: "101101010010010",
  z: "111001010100111", 0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110",
  4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111",
  9: "111101111001110", "_": "000000000000111", "-": "000000111000000", ":": "000010000010000", "/": "001001010100100",
  ".": "000000000000010", "+": "000010111010000", "*": "101010111010101", " ": "000000000000000", "(": "010100100100010", ")": "010001001001010",
};
function text(c, str, x, y, rgb = INKC, s = 2) {
  let cx = x;
  for (const ch of String(str).toLowerCase()) {
    const g = FONT[ch] ?? FONT["."];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === "1") fill(c, cx + i * s, y + j * s, s, s, rgb);
    cx += 4 * s;
  }
  return cx;
}

const CELL = 48 * SCALE;
const PAD = 4;
const bad = (img) => {
  const a = rig.auditFrame(img);
  return a.offPalette || a.semi || a.edge;
};
function cell(c, img, x, y) {
  fill(c, x, y, CELL, CELL, CARD);
  frameAt(c, img, x, y);
  if (bad(img)) box(c, x, y, CELL, CELL, RED);
}
const save = (name, c) => {
  const p = join(OUT, name);
  writeFileSync(p, encodePng(c));
  console.log(`${p}  ${c.w}x${c.h}`);
};

const ALL = [...MASCOTS, ...SPECIES];
const STAGES = LIFE_STAGES.map((s) => s.key);
const LABEL_W = 30 * 8;
const HEAD_H = 40;

// ---------------------------------------------------------------- sheets
function stagesSheet() {
  const groups = 3;
  const per = Math.ceil(ALL.length / groups);
  const gw = LABEL_W + STAGES.length * (CELL + PAD) + 24;
  const c = canvas(groups * gw, HEAD_H + 20 + per * (CELL + PAD));
  text(c, `rig2 stages: ${ALL.length} species x ${STAGES.length} stages, view s, idle 0, level ${LEVEL}`, 8, 8, INKC, 3);
  for (let g = 0; g < groups; g++) {
    const x0 = g * gw + 8;
    STAGES.forEach((st, i) => text(c, st, x0 + LABEL_W + i * (CELL + PAD), HEAD_H, MUTED));
    ALL.slice(g * per, (g + 1) * per).forEach((sp, r) => {
      const y = HEAD_H + 20 + r * (CELL + PAD);
      text(c, sp.id, x0, y + CELL / 2 - 10);
      text(c, `${sp.body} ${sp.rarity === "thuong" ? "" : sp.rarity}`, x0, y + CELL / 2 + 4, MUTED);
      STAGES.forEach((st, i) => cell(c, rig.renderFrame(sp, st, "S", {}, {}, { level: LEVEL }).img, x0 + LABEL_W + i * (CELL + PAD), y));
    });
  }
  save("rig2-stages.png", c);
}

function dirsSheet() {
  const groups = 3;
  const per = Math.ceil(ALL.length / groups);
  const cols = ["S", "E", "N", "W", "walk-E1"];
  const gw = LABEL_W + cols.length * (CELL + PAD) + 24;
  const c = canvas(groups * gw, HEAD_H + 20 + per * (CELL + PAD));
  text(c, `rig2 directions: ${ALL.length} adults x s e n w (+ walk e frame 1), level ${LEVEL}`, 8, 8, INKC, 3);
  for (let g = 0; g < groups; g++) {
    const x0 = g * gw + 8;
    cols.forEach((v, i) => text(c, v, x0 + LABEL_W + i * (CELL + PAD), HEAD_H, MUTED));
    ALL.slice(g * per, (g + 1) * per).forEach((sp, r) => {
      const y = HEAD_H + 20 + r * (CELL + PAD);
      text(c, sp.id, x0, y + CELL / 2 - 10);
      text(c, sp.body, x0, y + CELL / 2 + 4, MUTED);
      cols.forEach((v, i) => {
        const img = v === "walk-E1" ? rig.renderAnim(sp, "adult", "walk", "E", {}, { level: LEVEL }).frames[1].img : rig.renderFrame(sp, "adult", v, {}, {}, { level: LEVEL }).img;
        cell(c, img, x0 + LABEL_W + i * (CELL + PAD), y);
      });
    });
  }
  save("rig2-dirs.png", c);
}

function wearSheet() {
  // --wear-species a,b,c: these adults (plus a baby of the first) replace the default bodies.
  const ws = opt("wear-species", "") ? opt("wear-species", "").split(",") : null;
  const bodies = ws ? [...ws.map((b) => [b, "adult"]), [ws[0], "baby"]] : [["boba", "adult"], ["meo_bac", "adult"], ["canh_cut", "adult"], ["boba", "baby"]];
  const views = ["S", "E", "N"];
  const ids = Object.keys(WEARABLES).sort((a, b) => WEARABLES[a].slot.localeCompare(WEARABLES[b].slot) || a.localeCompare(b));
  const groups = 2;
  const per = Math.ceil(ids.length / groups);
  const status = rig.libraryStatus().wear;
  const gw = LABEL_W + bodies.length * views.length * (CELL + PAD) + bodies.length * 12 + 24;
  const c = canvas(groups * gw, HEAD_H + 20 + per * (CELL + PAD));
  const names = bodies.map(([b, st]) => (st === "adult" ? b : `${st} ${b}`)).join(" / ");
  text(c, `rig2 wear: ${ids.length} items x ${names} x s e n.  * = redrawn, others = legacy fallback`, 8, 8, INKC, 3);
  for (let g = 0; g < groups; g++) {
    const x0 = g * gw + 8;
    bodies.forEach(([b, st], bi) => views.forEach((v, vi) => text(c, `${st === "adult" ? b.slice(0, 4) : st} ${v}`, x0 + LABEL_W + bi * 12 + (bi * 3 + vi) * (CELL + PAD), HEAD_H, MUTED)));
    ids.slice(g * per, (g + 1) * per).forEach((id, r) => {
      const y = HEAD_H + 20 + r * (CELL + PAD);
      const slot = WEARABLES[id].slot;
      const done = status[slot].done.includes(id);
      text(c, `${done ? "*" : ""}${id}`, x0, y + CELL / 2 - 10, done ? INKC : MUTED);
      text(c, slot, x0, y + CELL / 2 + 4, MUTED);
      bodies.forEach(([b, st], bi) => views.forEach((v, vi) => {
        cell(c, rig.renderFrame(b, st, v, {}, { [slot]: id }, { level: LEVEL }).img, x0 + LABEL_W + bi * 12 + (bi * 3 + vi) * (CELL + PAD), y);
      }));
    });
  }
  save("rig2-wear.png", c);
}

function stripSheet(id) {
  const rows = [];
  for (const anim of ["idle", "walk"]) for (const v of ["S", "E", "N", "W"]) rows.push([anim, v]);
  for (const anim of ["wave", "jump", "sad", "think", "busy", "spin"]) rows.push([anim, "S"]);
  const c = canvas(LABEL_W + 6 * (CELL + PAD) + 16, HEAD_H + 8 + rows.length * (CELL + PAD));
  text(c, `rig2 strip: ${id} adult, level ${LEVEL}`, 8, 8, INKC, 3);
  rows.forEach(([anim, v], r) => {
    const y = HEAD_H + 8 + r * (CELL + PAD);
    text(c, `${anim}-${v}`, 8, y + CELL / 2 - 4);
    rig.renderAnim(id, "adult", anim, v, {}, { level: LEVEL }).frames.forEach((f, i) => cell(c, f.img, LABEL_W + i * (CELL + PAD), y));
  });
  save(`rig2-strip-${id}.png`, c);
}

/** Item sheets (one per slot): every item x 4 species x S E N W, adult and baby rows, plus the bag icon. */
function itemSheets() {
  const species = opt("wear-species", "boba,meo_bac,canh_cut,tho_la").split(",");
  const stages = ["adult", "baby"];
  const views = ["S", "E", "N", "W"];
  const walk = POSE === "walk1";
  const frameOf = (sp, st, v, wear) => (walk ? rig.renderAnim(sp, st, "walk", v, wear, { level: LEVEL }).frames[1].img : rig.renderFrame(sp, st, v, {}, wear, { level: LEVEL }).img);
  for (const slot of ["head", "face", "neck", "back", "charm"]) {
    const ids = Object.keys(WEARABLES).filter((id) => WEARABLES[id].slot === slot && (!IDS || IDS.includes(id))).sort();
    if (!ids.length) continue;
    const iconW = 64 * 4;
    const gw = species.length * (views.length * (CELL + PAD) + 12);
    const rowH = CELL + PAD;
    const c = canvas(LABEL_W + iconW + gw + 16, HEAD_H + 20 + ids.length * (2 * rowH + 16));
    text(c, `rig2 wear ${slot}: ${ids.length} items x ${species.join(" ")} x s e n w, adult + baby, ${walk ? "walk frame 1" : "idle 0"}, level ${LEVEL}`, 8, 8, INKC, 3);
    species.forEach((sp, si) => views.forEach((v, vi) => text(c, `${sp.slice(0, 8)} ${v}`, LABEL_W + iconW + si * (views.length * (CELL + PAD) + 12) + vi * (CELL + PAD), HEAD_H, MUTED)));
    ids.forEach((id, r) => {
      const y0 = HEAD_H + 20 + r * (2 * rowH + 16);
      text(c, id, 8, y0 + 8);
      text(c, WEARABLES[id].name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d"), 8, y0 + 24, MUTED);
      const icon = rig.wearIcon(id);
      if (icon) {
        frameAt(c, icon.img, LABEL_W, y0 + 44, 1);
        frameAt(c, icon.img, LABEL_W + icon.img.w + 8, y0 + 44, 3);
      }
      stages.forEach((st, k) => {
        const y = y0 + k * rowH;
        text(c, st, LABEL_W + iconW - 64, y + CELL / 2 - 4, MUTED);
        species.forEach((sp, si) => views.forEach((v, vi) => {
          cell(c, frameOf(sp, st, v, { [slot]: id }), LABEL_W + iconW + si * (views.length * (CELL + PAD) + 12) + vi * (CELL + PAD), y);
        }));
      });
    });
    save(`rig2-wear-${slot}${walk ? "-walk1" : ""}.png`, c);
  }
}

if (ONLY.includes("stages")) stagesSheet();
if (ONLY.includes("dirs")) dirsSheet();
if (ONLY.includes("wear")) wearSheet();
if (ONLY.includes("items")) itemSheets();
if (ONLY.includes("strip")) for (const id of STRIP.length ? STRIP : ["boba"]) stripSheet(id);
