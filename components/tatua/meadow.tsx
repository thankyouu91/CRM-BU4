"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Pet Town's sign-in backdrop on play.petfarm.online: a sunny meadow on one fixed canvas, with
 * a barn, a turning windmill, drifting clouds, butterflies, and the game's own pets (drawn by
 * the game's rig, public/ta-tua/game/js/petsheet.js) walking about, waving, jumping, spinning.
 * Pointing at a pet makes it jump with a heart and shows its species and rarity; clicking it
 * spins it in a shower of hearts. Pointer events over the card are left to the card.
 *
 * Kept light: DPR at most 1.5, 30 fps, paused while the tab is hidden, rebuilt 200 ms after a
 * resize (the same pets stay), and a still frame of idle pets under reduced motion. The scenery is drawn once into
 * an offscreen layer; the pets' module loads after first paint, so the meadow shows at once.
 */
export function MeadowShell({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => (host ? startMeadow(host) : undefined), [host]);
  return (
    <>
      <canvas
        ref={setHost}
        aria-hidden
        className="fixed inset-0 h-full w-full print:hidden"
        style={{ background: "linear-gradient(#9fd6ff, #cdeeff 34%, #fff4dc 56%, #98d67a 63%, #6fb554)" }}
      />
      <main className="pointer-events-none relative flex min-h-dvh justify-center px-4 pb-24 pt-[7vh] sm:items-center sm:py-10">
        <div
          data-meadow-card
          className={cn(
            "pointer-events-auto h-fit w-full max-w-sm rounded-xl border bg-card/95 p-6 backdrop-blur-sm",
            "shadow-[0_1px_2px_rgba(28,31,38,0.05),0_18px_40px_-18px_rgba(40,70,40,0.35)]",
          )}
        >
          {children}
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------- engine

type RigSheet = { url: string; frameW: number; frameH: number; cols: number; anims: Record<string, { row: number; frames: number; fps: number }> };
type Species = { id: string; name: string; rarity: string };
type Rarity = { name: string; color: string };
interface PetArt {
  rigSheet: (speciesId: string, stage: string) => RigSheet;
  SPECIES: Species[];
  RARITIES: Record<string, Rarity>;
}

interface Sheet {
  s: RigSheet;
  img: HTMLImageElement;
  ready: boolean;
  fw: number;
  fh: number;
}
interface Pet {
  sp: Species;
  sheet: Sheet;
  x: number;
  y: number;
  /** Depth in the meadow, 0 (back fence) to 1 (front): y follows it when the size changes. */
  d: number;
  dir: number;
  act: string;
  until: number;
  born: number;
  speed: number;
  phase: number;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Fly {
  x: number;
  y: number;
  ph: number;
  c: string;
}
interface Heart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  s: number;
}

const FPS = 30;
const DPR_MAX = 1.5;
const ACTS = ["idle", "idle", "wave", "jump", "spin", "think"];
const STAGES = ["baby", "kid", "teen", "young", "adult"];
const FLOWERS = ["#ffffff", "#ffd84d", "#ff8fb1", "#b69cff", "#ff9e5e"];
const WINGS = ["#ffb3d1", "#fff27a", "#a9d8ff", "#ffc78a"];

/** mulberry32: the same seed gives the same meadow. */
type Rng = () => number;
const rng = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
  const rg = g.createRadialGradient(x, y, 0, x, y, r);
  rg.addColorStop(0, `rgba(${rgb},${a})`);
  rg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rg;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
}

/** Runs the meadow on `canvas`; returns the function that stops it. */
function startMeadow(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, DPR_MAX);
  const seed = (Math.random() * 2 ** 31) | 0;
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  let W = 0;
  let H = 0;
  // Separate streams: the scenery's (reseeded per size, and how much grass a size needs varies),
  // the sky's, and the pets' (never reseeded), so a resize redraws the land but keeps the same pets.
  let R = rng(seed);
  let S = rng(seed ^ 0x51ed270b);
  const P = rng(seed ^ 0x9e3779b9);
  let bg: HTMLCanvasElement | null = null;
  let mill: { x: number; y: number; r: number } | null = null;
  let art: PetArt | null = null;
  let legendary: Species[] = [];
  let common: Species[] = [];
  let pets: Pet[] = [];
  let clouds: Cloud[] = [];
  let flies: Fly[] = [];
  let hearts: Heart[] = [];
  let hovered: Pet | null = null;
  let pointer: { x: number; y: number } | null = null;
  let raf = 0;
  let last = 0;
  let prev = 0;
  let stopped = false;
  const sheets = new Map<string, Sheet>();

  const pick = <T,>(arr: T[], r: Rng = R) => arr[Math.floor(r() * arr.length)];
  const narrow = () => W < 640;
  const horizon = () => H * (narrow() ? 0.6 : 0.56);
  const groundTop = () => horizon() + H * 0.07;
  const depthY = (d: number) => groundTop() + 30 + d * (H - groundTop() - 46);
  const petCount = () => (narrow() ? 7 : 13);
  const still = () => {
    if (reduce && !stopped) draw(performance.now());
  };

  function sheetOf(id: string, stage: string): Sheet {
    const key = `${id}|${stage}`;
    let entry = sheets.get(key);
    if (!entry) {
      const s = art!.rigSheet(id, stage);
      const img = new Image();
      const made: Sheet = { s, img, ready: false, fw: 0, fh: 0 };
      img.onload = () => {
        made.fw = img.width / s.cols;
        made.fh = made.fw * (s.frameH / s.frameW);
        made.ready = true;
        still();
      };
      img.src = s.url;
      sheets.set(key, made);
      entry = made;
    }
    return entry;
  }

  // ---- the scenery, drawn once per size: sky, sun, hills and trees, barn and windmill, fence, grass and flowers
  function buildScenery() {
    bg = document.createElement("canvas");
    bg.width = Math.round(W * DPR);
    bg.height = Math.round(H * DPR);
    const g = bg.getContext("2d")!;
    g.scale(DPR, DPR);
    const hz = horizon();
    const gt = groundTop();

    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#9fd6ff");
    sky.addColorStop(0.6, "#cdeeff");
    sky.addColorStop(1, "#fff4dc");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, hz + 4);
    const sunX = W * (narrow() ? 0.82 : 0.86);
    const sunY = H * 0.13;
    glow(g, sunX, sunY, Math.max(W, H) * 0.32, "255,236,170", 0.55);
    g.fillStyle = "#fff2b8";
    g.beginPath();
    g.arc(sunX, sunY, Math.min(W, H) * 0.055, 0, Math.PI * 2);
    g.fill();

    const hill = (base: number, amp: number, len: number, color: string, phase: number) => {
      const yAt = (x: number) => base - amp * (0.55 + 0.45 * Math.sin(x / len + phase)) - amp * 0.25 * Math.sin(x / (len * 0.43) + phase * 2);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, yAt(x));
      g.lineTo(W, H);
      g.closePath();
      g.fill();
      return yAt;
    };
    const farY = hill(hz, H * 0.09, W * 0.16, "#bfe3a8", R() * 6);
    for (let i = 0; i < 9; i++) {
      const r = 8 + R() * 10;
      const x = R() * W;
      const y = farY(x) + r * 0.2;
      g.fillStyle = "#8a6b4e";
      g.fillRect(x - 1.5, y, 3, r * 0.9);
      g.fillStyle = R() < 0.5 ? "#8fcf78" : "#7fc46c";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    hill(hz + H * 0.05, H * 0.06, W * 0.11, "#a6d98a", R() * 6);

    // the farm in "petfarm": a red barn and a windmill (its sails turn each frame)
    const bx = W * (narrow() ? 0.12 : 0.76);
    const by = hz + H * 0.025;
    const bw = Math.max(46, W * 0.045);
    const bh = bw * 0.72;
    g.fillStyle = "#d4513f";
    g.fillRect(bx, by - bh, bw, bh);
    g.fillStyle = "#a83a2d";
    g.beginPath();
    g.moveTo(bx - 4, by - bh);
    g.lineTo(bx + bw / 2, by - bh - bw * 0.42);
    g.lineTo(bx + bw + 4, by - bh);
    g.closePath();
    g.fill();
    g.fillStyle = "#fff";
    g.fillRect(bx + bw * 0.36, by - bh * 0.62, bw * 0.28, bh * 0.62);
    g.strokeStyle = "#d4513f";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(bx + bw * 0.36, by - bh * 0.62);
    g.lineTo(bx + bw * 0.64, by);
    g.moveTo(bx + bw * 0.64, by - bh * 0.62);
    g.lineTo(bx + bw * 0.36, by);
    g.stroke();
    const mx = bx + bw * (narrow() ? 1.9 : -0.9);
    const my = hz + H * 0.03;
    const mh = bw * 1.5;
    g.fillStyle = "#f3ead8";
    g.beginPath();
    g.moveTo(mx - mh * 0.14, my);
    g.lineTo(mx - mh * 0.07, my - mh);
    g.lineTo(mx + mh * 0.07, my - mh);
    g.lineTo(mx + mh * 0.14, my);
    g.closePath();
    g.fill();
    g.fillStyle = "#c9b48f";
    g.fillRect(mx - mh * 0.04, my - mh * 0.3, mh * 0.08, mh * 0.3);
    mill = { x: mx, y: my - mh, r: mh * 0.62 };

    const meadow = g.createLinearGradient(0, gt - H * 0.04, 0, H);
    meadow.addColorStop(0, "#98d67a");
    meadow.addColorStop(1, "#6fb554");
    g.fillStyle = meadow;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, gt - H * 0.012 * Math.sin(x / (W * 0.09)));
    g.lineTo(W, H);
    g.closePath();
    g.fill();
    // a wooden fence along the back of the meadow
    const fy = gt - H * 0.005;
    g.fillStyle = "#c79a68";
    for (let x = 6; x < W; x += 34) g.fillRect(x, fy - 26, 5, 30);
    g.fillRect(0, fy - 20, W, 4);
    g.fillRect(0, fy - 9, W, 4);
    // mown stripes, then grass tufts and flowers, denser towards the front
    for (let i = 0; i < 7; i++) {
      g.fillStyle = `rgba(255,255,255,${0.04 + (i % 2) * 0.03})`;
      g.fillRect(0, gt + (H - gt) * (i / 7), W, (H - gt) / 14);
    }
    const tufts = Math.round((W * (H - gt)) / 900);
    for (let i = 0; i < tufts; i++) {
      const y = gt + (H - gt) * Math.sqrt(R());
      const x = R() * W;
      const s = 0.6 + ((y - gt) / (H - gt)) * 1.2;
      g.strokeStyle = R() < 0.5 ? "#5fa646" : "#7cc35f";
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 3 * s, y - 7 * s);
      g.moveTo(x, y);
      g.lineTo(x + 1, y - 9 * s);
      g.moveTo(x, y);
      g.lineTo(x + 4 * s, y - 6 * s);
      g.stroke();
      if (R() < 0.18) {
        g.fillStyle = pick(FLOWERS);
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(x + Math.cos(k * 1.26) * 2.6 * s, y - 10 * s + Math.sin(k * 1.26) * 2.6 * s, 1.8 * s, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "#ffcf3a";
        g.beginPath();
        g.arc(x, y - 10 * s, 1.4 * s, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // ---- pets: walk about, stop, wave, jump, spin or think; nearer pets are bigger
  function pickAct(p: Pet, now: number) {
    if (reduce) {
      p.act = "idle";
      p.until = Infinity;
    } else if (p.act !== "walk" && P() < 0.75) {
      p.act = "walk";
      p.dir = P() < 0.5 ? -1 : 1;
      p.until = now + 2500 + P() * 6000;
    } else {
      p.act = pick(ACTS, P);
      p.until = now + (p.act === "idle" ? 1500 + P() * 3500 : 1400 + P() * 1200);
    }
    p.born = now;
  }
  function addPet(x: number) {
    // about one in eight is legendary (the rest come from the other rarities only)
    const sp = P() < 0.12 && legendary.length ? pick(legendary, P) : pick(common, P);
    const stage = pick(STAGES, P);
    const d = P();
    const now = performance.now();
    const p: Pet = {
      sp,
      sheet: sheetOf(sp.id, stage),
      x,
      y: depthY(d),
      d,
      dir: P() < 0.5 ? -1 : 1,
      act: "walk",
      until: 0,
      born: now - P() * 4000,
      speed: 18 + P() * 22,
      phase: P() * 10,
    };
    pickAct(p, now);
    pets.push(p);
  }
  function placePets() {
    pets = [];
    hovered = null;
    if (!art) return;
    const n = petCount();
    for (let i = 0; i < n; i++) addPet((W / n) * (i + 0.5) + (P() - 0.5) * 40);
  }
  const scaleOf = (p: Pet) => {
    const depth = (p.y - groundTop()) / (H - groundTop());
    return narrow() ? 1.15 + depth * 0.6 : 1.5 + depth;
  };
  const animOf = (p: Pet) => (p.act === "walk" ? (p.dir > 0 ? "runRight" : "runLeft") : p.act);
  function boxOf(p: Pet): Box | null {
    const e = p.sheet;
    if (!e.ready) return null;
    const s = scaleOf(p);
    const w = e.fw * s;
    const h = e.fh * s;
    return { x: p.x - w / 2, y: p.y - h, w, h };
  }
  function drawPet(p: Pet, now: number, dt: number) {
    if (p.act === "walk") {
      p.x += p.dir * p.speed * dt * (scaleOf(p) / 2);
      if (p.x < -40) {
        p.x = -40;
        p.dir = 1;
      } else if (p.x > W + 40) {
        p.x = W + 40;
        p.dir = -1;
      }
    }
    if (now > p.until) pickAct(p, now);
    const b = boxOf(p);
    if (!b) return;
    const e = p.sheet;
    const a = e.s.anims[animOf(p)] ?? e.s.anims.idle;
    const f = reduce ? 0 : Math.floor(((now - p.born) / 1000) * a.fps) % a.frames;
    ctx!.fillStyle = "rgba(40,80,30,0.22)";
    ctx!.beginPath();
    ctx!.ellipse(p.x, p.y - 2, b.w * 0.24, b.w * 0.07, 0, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.drawImage(e.img, f * e.fw, a.row * e.fh, e.fw, e.fh, Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h));
    if (p.sp.rarity === "huyenthoai" && !reduce) {
      for (let k = 0; k < 3; k++) {
        const t = now / 700 + k * 2.1 + p.phase;
        ctx!.fillStyle = `rgba(255,214,90,${Math.max(0, Math.sin(t * 2))})`;
        const sx = b.x + b.w * (0.2 + 0.3 * (Math.sin(t) + 1));
        const sy = b.y + b.h * (0.15 + 0.25 * (Math.cos(t * 1.3) + 1));
        ctx!.fillRect(sx - 1, sy - 4, 2, 8);
        ctx!.fillRect(sx - 4, sy - 1, 8, 2);
      }
    }
  }

  // ---- clouds, butterflies, hearts, the windmill's sails, the name tag
  function makeSky() {
    clouds = Array.from({ length: narrow() ? 4 : 7 }, () => ({ x: S() * W, y: H * (0.05 + S() * 0.3), s: 0.6 + S() * 0.9, v: 4 + S() * 6 }));
    flies = Array.from({ length: narrow() ? 2 : 4 }, () => ({ x: S() * W, y: groundTop() + S() * (H - groundTop()) * 0.6, ph: S() * 6, c: pick(WINGS, S) }));
  }
  function drawCloud(c: Cloud) {
    ctx!.fillStyle = "rgba(255,255,255,0.92)";
    ctx!.beginPath();
    for (const [dx, dy, r] of [
      [0, 0, 22],
      [24, -10, 26],
      [52, 0, 20],
      [26, 8, 22],
    ]) {
      ctx!.moveTo(c.x + dx * c.s + r * c.s, c.y + dy * c.s);
      ctx!.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2);
    }
    ctx!.fill();
  }
  function drawFly(f: Fly, t: number, dt: number) {
    f.ph += dt;
    f.x += Math.cos(f.ph * 0.4) * 22 * dt;
    f.y += Math.sin(f.ph * 0.9) * 14 * dt;
    if (f.x < -10) f.x = W + 10;
    if (f.x > W + 10) f.x = -10;
    f.y = Math.min(H - 20, Math.max(horizon(), f.y));
    const flap = Math.abs(Math.sin(t * 14 + f.ph)) * 5 + 1;
    ctx!.fillStyle = f.c;
    ctx!.beginPath();
    ctx!.ellipse(f.x - flap * 0.6, f.y, flap, 4, -0.4, 0, Math.PI * 2);
    ctx!.ellipse(f.x + flap * 0.6, f.y, flap, 4, 0.4, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.fillStyle = "#4a3a2a";
    ctx!.fillRect(f.x - 0.6, f.y - 3, 1.2, 6);
  }
  function addHeart(x: number, y: number, burst = false) {
    hearts.push({ x, y, vx: burst ? (P() - 0.5) * 80 : 0, vy: burst ? -60 - P() * 60 : -40, life: 0, s: burst ? 0.7 + P() * 0.6 : 1 });
  }
  function drawHearts(dt: number) {
    for (const h of hearts) {
      h.life += dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 20 * dt;
      const s = 6 * h.s;
      ctx!.fillStyle = `rgba(255,92,128,${Math.max(0, 1 - h.life / 1.4)})`;
      ctx!.beginPath();
      ctx!.arc(h.x - s * 0.5, h.y, s * 0.55, Math.PI, 0);
      ctx!.arc(h.x + s * 0.5, h.y, s * 0.55, Math.PI, 0);
      ctx!.lineTo(h.x, h.y + s * 1.1);
      ctx!.closePath();
      ctx!.fill();
    }
    hearts = hearts.filter((h) => h.life < 1.4);
  }
  function drawMill(t: number) {
    if (!mill) return;
    ctx!.save();
    ctx!.translate(mill.x, mill.y);
    ctx!.rotate(reduce ? 0.4 : t * 0.6);
    ctx!.fillStyle = "#fbf7ef";
    ctx!.strokeStyle = "#b99b73";
    ctx!.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      ctx!.rotate(Math.PI / 2);
      ctx!.beginPath();
      ctx!.rect(-mill.r * 0.06, -mill.r, mill.r * 0.2, mill.r * 0.86);
      ctx!.fill();
      ctx!.stroke();
    }
    ctx!.restore();
    ctx!.fillStyle = "#8b6b47";
    ctx!.beginPath();
    ctx!.arc(mill.x, mill.y, 3.5, 0, Math.PI * 2);
    ctx!.fill();
  }
  function nameTag(p: Pet) {
    const b = boxOf(p);
    if (!b || !art) return;
    const rarity = art.RARITIES[p.sp.rarity];
    const text = rarity ? `${p.sp.name} · ${rarity.name}` : p.sp.name;
    ctx!.font = `600 12px ${font}`;
    const w = ctx!.measureText(text).width + 16;
    const x = Math.round(Math.min(Math.max(4, p.x - w / 2), W - w - 4));
    const y = Math.round(Math.max(26, b.y - 6));
    ctx!.fillStyle = "rgba(255,255,255,0.95)";
    ctx!.strokeStyle = rarity?.color ?? "#9b8a7a";
    ctx!.lineWidth = 1.5;
    ctx!.beginPath();
    ctx!.roundRect(x, y - 22, w, 22, 11);
    ctx!.fill();
    ctx!.stroke();
    ctx!.fillStyle = "#1c1f26";
    ctx!.fillText(text, x + 8, y - 7);
  }

  // ---- one frame
  function draw(now: number) {
    if (!bg) return;
    const t = now / 1000;
    const dt = prev ? Math.min((now - prev) / 1000, 0.1) : 0;
    prev = now;
    ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx!.imageSmoothingEnabled = true;
    ctx!.drawImage(bg, 0, 0, W, H);
    for (const c of clouds) {
      if (!reduce) {
        c.x += c.v * dt;
        if (c.x > W + 80) c.x = -140;
      }
      drawCloud(c);
    }
    drawMill(t);
    ctx!.imageSmoothingEnabled = false;
    pets.sort((a, b) => a.y - b.y);
    for (const p of pets) drawPet(p, now, dt);
    if (!reduce) for (const f of flies) drawFly(f, t, dt);
    // pets walk in and out under a still pointer
    if (pointer && !reduce) setHover(petAt(pointer.x, pointer.y));
    if (hovered) nameTag(hovered);
    drawHearts(dt);
  }
  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS - 3) return;
    last = now;
    draw(now);
  }
  function run() {
    cancelAnimationFrame(raf);
    prev = 0;
    if (reduce) return still();
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  /** Sizes everything to the laid-out canvas (the viewport without a classic scrollbar). */
  function build() {
    const oldW = W;
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    R = rng(seed);
    buildScenery();
    S = rng(seed ^ 0x51ed270b);
    makeSky();
    hearts = [];
    // the same pets stay (a phone's toolbar sliding away only changes the height), unless the count changes
    if (pets.length && pets.length === petCount()) {
      for (const p of pets) {
        p.x *= W / oldW;
        p.y = depthY(p.d);
      }
    } else placePets();
  }

  const onVisibility = () => (document.visibilityState === "visible" ? run() : cancelAnimationFrame(raf));
  let resizeTimer = 0;
  const sizer = new ResizeObserver(() => {
    if (canvas.clientWidth === W && canvas.clientHeight === H) return;
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      build();
      still();
    }, 200);
  });

  // pointing at a pet: it jumps with a heart and shows its name; clicking: it spins in a shower of hearts
  const onScene = (e: Event) => !(e.target instanceof Element && e.target.closest("[data-meadow-card]"));
  const petAt = (x: number, y: number) => {
    for (let i = pets.length - 1; i >= 0; i--) {
      const b = boxOf(pets[i]);
      if (b && x > b.x + b.w * 0.2 && x < b.x + b.w * 0.8 && y > b.y + b.h * 0.25 && y < b.y + b.h) return pets[i];
    }
    return null;
  };
  function setHover(p: Pet | null) {
    if (p === hovered) return;
    document.body.style.cursor = p ? "pointer" : "";
    if (p && !reduce) {
      p.act = "jump";
      p.born = performance.now();
      p.until = p.born + 700;
      const b = boxOf(p)!;
      addHeart(p.x, b.y + b.h * 0.2);
    }
    hovered = p;
    still();
  }
  const onPointerMove = (e: PointerEvent) => {
    pointer = onScene(e) ? { x: e.clientX, y: e.clientY } : null;
    setHover(pointer ? petAt(pointer.x, pointer.y) : null);
  };
  // a finger lifted, or the pointer left the window: nothing is pointed at any more
  const onPointerGone = (e: PointerEvent) => {
    if (e.type === "pointerout" ? e.relatedTarget : e.pointerType === "mouse") return;
    pointer = null;
    setHover(null);
  };
  const onClick = (e: MouseEvent) => {
    if (reduce || !onScene(e)) return;
    const p = petAt(e.clientX, e.clientY);
    if (!p) return;
    p.act = "spin";
    p.born = performance.now();
    p.until = p.born + 1200;
    const b = boxOf(p)!;
    for (let i = 0; i < 7; i++) addHeart(p.x, b.y + b.h * 0.3, true);
  };

  build();
  run();
  document.addEventListener("visibilitychange", onVisibility);
  sizer.observe(canvas);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerGone);
  window.addEventListener("pointercancel", onPointerGone);
  document.addEventListener("pointerout", onPointerGone);
  window.addEventListener("click", onClick);

  // The pets come from the game's own drawing code, loaded after the scenery is up.
  Promise.all([import("@/public/ta-tua/game/js/petsheet.js"), import("@/public/ta-tua/game/js/shared/pets.js")])
    .then(([sheet, data]) => {
      if (stopped) return;
      art = { rigSheet: sheet.rigSheet, SPECIES: data.SPECIES, RARITIES: data.RARITIES };
      legendary = art.SPECIES.filter((s) => s.rarity === "huyenthoai");
      common = art.SPECIES.filter((s) => s.rarity !== "huyenthoai");
      placePets();
    })
    .catch(() => {
      // no pets, the meadow stays
    });

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    sizer.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerGone);
    window.removeEventListener("pointercancel", onPointerGone);
    document.removeEventListener("pointerout", onPointerGone);
    window.removeEventListener("click", onClick);
    document.body.style.cursor = "";
  };
}
