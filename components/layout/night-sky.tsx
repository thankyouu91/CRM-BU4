"use client";

import { useEffect, useState } from "react";

/**
 * The dark theme's backdrop: a night sky with the Milky Way, three wooded
 * ridges and a small tent, drawn on one fixed canvas behind the app shell.
 * Plain Canvas 2D, nothing fetched. Mounted once in the shell, so it survives
 * route changes; it draws only while the dark theme is on and the tab is
 * visible. While it is on, `data-night` on <html> lets globals.css make the
 * page, the sidebar, the header and the cards translucent.
 *
 * Sky and land are built once to offscreen canvases; a frame is one drawImage
 * of the sky (with a slow sway), the twinkling stars, any meteors, the land and
 * the tent. Pointing at the tent turns its lantern up; tapping toggles it; a
 * click on open sky sends a shooting star.
 */
export function NightSky() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!dark) return;
    document.documentElement.setAttribute("data-night", "");
    return () => document.documentElement.removeAttribute("data-night");
  }, [dark]);
  if (!dark) return null;
  return <NightCanvas />;
}

function NightCanvas() {
  const [host, setHost] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => (host ? startScene(host) : undefined), [host]);
  return <canvas ref={setHost} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full print:hidden" />;
}

type Rng = () => number;
type Noise = (x: number, octaves?: number) => number;
interface Twinkle { x: number; y: number; r: number; a: number; f: number; p: number; c: string }
interface Meteor { x: number; y: number; born: number; vx: number; vy: number; speed: number; len: number; life: number }

const DPR_MAX = 1.5; // sharp enough, far cheaper on retina screens
const FPS = 30; // the sky moves slowly; 30 frames look the same as 60
const MARGIN = 0.18; // sky drawn larger than the screen so its slow sway never shows an edge
const SEED = 20261029;
const TINTS = ["255,255,255", "205,218,255", "255,232,200", "190,205,255"];

/** Elements the scene does not show through: pointer events over them are not sky or tent. */
const COVER = "aside, header, nav, .bg-card, button, a, input, select, textarea, label, table, [role='dialog'], [role='menu'], [role='listbox']";

function startScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, DPR_MAX);

  let W = 0;
  let H = 0;
  let sky!: HTMLCanvasElement;
  let land!: HTMLCanvasElement;
  let twinkles: Twinkle[] = [];
  let meteors: Meteor[] = [];
  let tent: { x: number; y: number; w: number } | null = null;
  let tentGlow = 0;
  let tentTarget = 0;
  let tentHover = false;
  let tentLit = false;
  let nextMeteor = 0;
  let raf = 0;
  let last = 0;
  const start = performance.now();
  let R: Rng;

  // ---- randomness and noise (seeded, so the same sky comes back on every visit) ----
  const rng = (a: number): Rng => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u = 0;
    while (!u) u = R();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R());
  };
  const makeNoise = (): Noise => {
    const p = Array.from({ length: 256 }, () => R());
    const n = (x: number) => {
      const i = Math.floor(x);
      const f = x - i;
      const s = f * f * (3 - 2 * f);
      return p[i & 255] * (1 - s) + p[(i + 1) & 255] * s;
    };
    return (x, oct = 4) => {
      let v = 0;
      let a = 1;
      let norm = 0;
      let f = 1;
      for (let k = 0; k < oct; k++) {
        v += a * n(x * f);
        norm += a;
        a *= 0.5;
        f *= 2.03;
      }
      return v / norm;
    };
  };
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",");
  const bump = (t: number, c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));
  const blob = (g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${rgb},${a})`);
    rg.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  };
  const makeSprite = (rgb: string) => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    blob(g, 32, 32, 32, rgb, 0.55);
    blob(g, 32, 32, 6, "255,255,255", 1);
    return c;
  };
  const sprites: Record<string, HTMLCanvasElement> = {};
  for (const c of TINTS) sprites[c] = makeSprite(c);

  // ---- the sky: gradient, Milky Way glow, band stars, dust lanes, field stars (drawn once) ----
  function buildSky() {
    const SW = W * (1 + 2 * MARGIN);
    const SH = H * (1 + 2 * MARGIN);
    const ox = W * MARGIN;
    const oy = H * MARGIN;
    sky = document.createElement("canvas");
    sky.width = Math.round(SW * DPR);
    sky.height = Math.round(SH * DPR);
    const s = sky.getContext("2d")!;
    s.scale(DPR, DPR);

    const g = s.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, "#020309");
    g.addColorStop(0.5, "#050918");
    g.addColorStop(0.8, "#0b142b");
    g.addColorStop(1, "#14223d");
    s.fillStyle = g;
    s.fillRect(0, 0, SW, SH);

    // The band rises from behind the hills at lower left to the top right; its bright core sits low, as in summer skies.
    const narrow = W < 640;
    const ax = ox + (narrow ? -0.35 : -0.12) * W;
    const ay = oy + 0.98 * H;
    const bx = ox + (narrow ? 1.35 : 1.12) * W;
    const by = oy;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const base = Math.min(W, H) * 0.15 + Math.max(W, H) * 0.03;
    const core = 0.27;
    const width = (t: number) => base * (0.55 + 0.9 * bump(t, core, 0.2));
    const bright = (t: number) => 0.22 + 0.95 * bump(t, core, 0.22);
    const at = (t: number, off: number): [number, number] => [ax + dx * t + nx * off, ay + dy * t + ny * off];
    const cool = [150, 172, 255];
    const warm = [255, 212, 168];
    const laneNoise = makeNoise();
    const gapNoise = makeNoise();

    s.globalCompositeOperation = "lighter";
    for (let i = 0; i < 1100; i++) {
      const t = R() * 1.1 - 0.05;
      const w = width(t);
      const off = gauss() * w * 0.45;
      const [x, y] = at(t, off);
      const k = bump(t, core, 0.25);
      const fall = Math.max(0, 1 - Math.abs(off) / (w * 1.4));
      blob(s, x, y, w * (0.35 + R() * 0.7), mix(cool, warm, k), 0.017 * bright(t) * fall + 0.003);
    }
    // faint hydrogen-pink and teal clouds along the band
    for (let i = 0; i < 18; i++) {
      const t = 0.1 + R() * 0.6;
      const w = width(t);
      const [x, y] = at(t, gauss() * w * 0.4);
      blob(s, x, y, w * (0.12 + R() * 0.2), R() < 0.7 ? "255,105,150" : "90,210,200", 0.035 + R() * 0.03);
    }
    // stars packed into the band
    const want = Math.min(90000, Math.round((W * H) / 20));
    for (let n = 0, tries = 0; n < want && tries < want * 4; tries++) {
      const t = R() * 1.08 - 0.04;
      if (R() > bright(t) / 1.17) continue;
      n++;
      const w = width(t);
      const [x, y] = at(t, gauss() * w * 0.42);
      const big = R() > 0.975;
      const sz = big ? 1.1 + R() * 0.8 : 0.45 + R() * 0.6;
      s.fillStyle = `rgba(${mix(cool, warm, bump(t, core, 0.25) * R())},${(big ? 0.6 : 0.2) + R() * 0.45})`;
      s.fillRect(x, y, sz, sz);
    }
    // dark dust lanes that split the bright core
    s.globalCompositeOperation = "source-over";
    for (let i = 0; i < 1500; i++) {
      const t = R() * 1.05 - 0.02;
      const w = width(t);
      const off = (laneNoise(t * 5) - 0.5) * w * 0.7 + gauss() * w * 0.12;
      if (gapNoise(t * 9 + (off / w) * 1.5) < 0.42) continue;
      const [x, y] = at(t, off);
      blob(s, x, y, w * (0.06 + R() * 0.16), "3,5,12", (0.1 + R() * 0.16) * (0.5 + bump(t, core, 0.3)));
    }
    // stars across the whole sky, in front of the dust
    s.globalCompositeOperation = "lighter";
    const field = Math.round((SW * SH) / 260);
    for (let i = 0; i < field; i++) {
      const sz = R() > 0.94 ? 1 + R() * 0.7 : 0.4 + R() * 0.55;
      s.fillStyle = `rgba(${TINTS[(R() * 4) | 0]},${0.2 + R() * 0.6})`;
      s.fillRect(R() * SW, R() * SH, sz, sz);
    }

    // the few bright stars that twinkle (screen coordinates, above the hills)
    twinkles = Array.from({ length: Math.round(Math.min(160, (W * H) / 9000)) }, () => ({
      x: R() * W * 1.2 - W * 0.1,
      y: R() * H * 0.72 - H * 0.08,
      r: 3 + R() * (R() > 0.9 ? 9 : 4),
      a: 0.35 + R() * 0.55,
      f: 0.6 + R() * 2.2,
      p: R() * 6.28,
      c: TINTS[(R() * 4) | 0],
    }));
  }

  // ---- the ground: horizon glow, three ridges, pines, a clearing for the tent (drawn once, never moves) ----
  function buildLand() {
    land = document.createElement("canvas");
    land.width = Math.round(W * DPR);
    land.height = Math.round(H * DPR);
    const l = land.getContext("2d")!;
    l.scale(DPR, DPR);
    const narrow = W < 640;

    const hg = l.createLinearGradient(0, H * 0.45, 0, H);
    hg.addColorStop(0, "rgba(40,70,110,0)");
    hg.addColorStop(0.5, "rgba(70,105,140,0.16)");
    hg.addColorStop(0.72, "rgba(245,170,115,0.13)");
    hg.addColorStop(1, "rgba(245,170,115,0)");
    l.fillStyle = hg;
    l.fillRect(0, 0, W, H);

    const ridge = (baseY: number, amp: number, freq: number, fill: string | CanvasGradient) => {
      const nz = makeNoise();
      const yAt = (x: number) => baseY - amp * nz(x * freq, 5);
      l.beginPath();
      l.moveTo(0, H);
      for (let x = 0; x <= W + 4; x += 3) l.lineTo(x, yAt(x));
      l.lineTo(W, H);
      l.closePath();
      l.fillStyle = fill;
      l.fill();
      return yAt;
    };
    const pine = (x: number, y: number, h: number, color: string) => {
      l.fillStyle = color;
      l.beginPath();
      for (let k = 0; k < 3; k++) {
        const top = y - h + k * h * 0.28;
        const half = h * (0.16 + k * 0.07);
        l.moveTo(x, top);
        l.lineTo(x - half, top + h * 0.42);
        l.lineTo(x + half, top + h * 0.42);
      }
      l.fill();
      l.fillRect(x - h * 0.03, y - h * 0.12, h * 0.06, h * 0.14);
    };

    const farFill = l.createLinearGradient(0, H * 0.55, 0, H * 0.85);
    farFill.addColorStop(0, "#1e2947");
    farFill.addColorStop(1, "#111a31");
    ridge(H * 0.78, H * 0.2, 1 / 260, farFill);
    const mist = l.createLinearGradient(0, H * 0.68, 0, H * 0.84);
    mist.addColorStop(0, "rgba(130,160,200,0)");
    mist.addColorStop(1, "rgba(130,160,200,0.10)");
    l.fillStyle = mist;
    l.fillRect(0, H * 0.68, W, H * 0.16);

    const midY = ridge(H * 0.86, H * 0.13, 1 / 170, "#0a1021");
    for (let x = R() * 8; x < W; x += 4 + R() * 9) if (R() > 0.12) pine(x, midY(x) + 2, (7 + R() * 14) * (narrow ? 0.8 : 1), "#0a1021");

    const nearY = ridge(H * 0.97, H * 0.1, 1 / 130, "#03050b");
    // On the near ridge at desktop width; on the highest point of the middle ridge on phones.
    let tentX = W * 0.45;
    if (narrow) for (let x = W * 0.55; x <= W * 0.85; x += 4) if (midY(x) < midY(tentX)) tentX = x;
    const tentY = (narrow ? midY : nearY)(tentX) + 3;
    // a dense row of pines on the near ridge, with a small clearing for the tent
    for (let x = R() * 4; x < W; x += 3 + R() * 8) {
      if (Math.abs(x - tentX) < 40) continue;
      pine(x, nearY(x) + 3, (14 + R() * 36) * (R() > 0.85 ? 1.3 : 1) * (narrow ? 0.7 : 1), "#03050b");
    }
    tent = { x: tentX, y: tentY, w: narrow ? 26 : 34 };
  }

  // ---- the tent: dimly lit at rest; pointing at it (or tapping it) turns the lantern up ----
  const tentPath = (x: number, y: number, w: number, h: number) => {
    ctx!.beginPath();
    ctx!.moveTo(x - w / 2, y);
    ctx!.lineTo(x, y - h);
    ctx!.lineTo(x + w / 2, y);
    ctx!.closePath();
  };
  function drawTent(t: number) {
    if (!tent || !ctx) return;
    const { x, y, w } = tent;
    const h = w * 0.66;
    const k = tentGlow;
    const flicker = reduce ? 1 : 0.94 + 0.04 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 13.1);
    ctx.globalCompositeOperation = "lighter";
    blob(ctx, x, y - 8, 55 + 75 * k, "255,165,90", (0.09 + 0.3 * k) * flicker);
    if (k > 0.02) blob(ctx, x, y - h * 0.3, 18 + 10 * k, "255,220,160", 0.45 * k * flicker);
    ctx.globalCompositeOperation = "source-over";
    // dim canvas, then the lit canvas faded in over it
    const dim = ctx.createLinearGradient(x, y - h, x, y);
    dim.addColorStop(0, "#9c7650");
    dim.addColorStop(1, "#5e3417");
    ctx.fillStyle = dim;
    tentPath(x, y, w, h);
    ctx.fill();
    ctx.globalAlpha = k * flicker;
    const lit = ctx.createLinearGradient(x, y - h, x, y);
    lit.addColorStop(0, "#fff0cf");
    lit.addColorStop(1, "#e8873e");
    ctx.fillStyle = lit;
    tentPath(x, y, w, h);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = k > 0.5 ? "#4a230b" : "#1f0f05";
    tentPath(x, y, w * 0.24, h * 0.55);
    ctx.fill();
  }

  function build() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    R = rng(SEED);
    buildSky();
    buildLand();
    meteors = [];
    nextMeteor = performance.now() + 2500;
  }

  // ---- shooting stars ----
  function spawnMeteor(now: number, x?: number, y?: number) {
    const ang = Math.PI * (0.74 + R() * 0.1);
    meteors.push({
      x: x ?? W * (0.25 + R() * 0.75),
      y: y ?? H * (0.04 + R() * 0.3),
      born: now,
      vx: Math.cos(ang),
      vy: Math.sin(ang),
      speed: 650 + R() * 450,
      len: 110 + R() * 140,
      life: 650 + R() * 450,
    });
  }
  function drawMeteors(now: number) {
    if (!ctx) return;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    meteors = meteors.filter((m) => now - m.born < m.life);
    for (const m of meteors) {
      const age = (now - m.born) / 1000;
      const k = (now - m.born) / m.life;
      const hx = m.x + m.vx * m.speed * age;
      const hy = m.y + m.vy * m.speed * age;
      const tail = m.len * Math.min(1, k * 4);
      const a = Math.sin(Math.PI * k);
      const tx = hx - m.vx * tail;
      const ty = hy - m.vy * tail;
      const lg = ctx.createLinearGradient(tx, ty, hx, hy);
      lg.addColorStop(0, "rgba(200,220,255,0)");
      lg.addColorStop(1, `rgba(235,242,255,${0.9 * a})`);
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.drawImage(sprites["255,255,255"], hx - 6, hy - 6, 12, 12);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ---- one frame: sky (slow sway around a point below the horizon), twinkles, meteors, then the still ground ----
  function draw(now: number) {
    if (!ctx) return;
    const t = (now - start) / 1000;
    const ang = reduce ? 0 : Math.sin((t * 2 * Math.PI) / 300) * 0.035;
    const px = W * 0.5;
    const py = H * 1.5;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.translate(-px, -py);
    ctx.drawImage(sky, -W * MARGIN, -H * MARGIN, W * (1 + 2 * MARGIN), H * (1 + 2 * MARGIN));
    ctx.globalCompositeOperation = "lighter";
    for (const s of twinkles) {
      ctx.globalAlpha = reduce ? s.a : s.a * (0.5 + 0.5 * Math.sin(t * s.f + s.p));
      ctx.drawImage(sprites[s.c], s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    if (!reduce && now > nextMeteor) {
      spawnMeteor(now);
      nextMeteor = now + 4500 + R() * 7500;
    }
    if (meteors.length) drawMeteors(now);
    ctx.drawImage(land, 0, 0, W, H);
    tentGlow = reduce ? tentTarget : tentGlow + (tentTarget - tentGlow) * 0.12;
    drawTent(t);
  }

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS - 3) return;
    last = now;
    draw(now);
  }
  function run() {
    cancelAnimationFrame(raf);
    if (reduce) {
      draw(performance.now());
      return;
    }
    last = 0;
    raf = requestAnimationFrame(loop);
  }

  build();
  run();

  const onVisibility = () => {
    if (document.visibilityState === "visible") run();
    else cancelAnimationFrame(raf);
  };
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build();
      if (reduce) draw(performance.now());
    }, 200);
  };

  // The scene shows through wherever no card, sidebar, header or control sits on top of it.
  const onScene = (e: PointerEvent | MouseEvent) => !(e.target as Element | null)?.closest?.(COVER);
  const onTent = (e: PointerEvent | MouseEvent) => !!tent && Math.hypot(e.clientX - tent.x, e.clientY - (tent.y - tent.w * 0.3)) < tent.w * 1.1;
  const setTent = () => {
    tentTarget = tentHover || tentLit ? 1 : 0;
    if (reduce) draw(performance.now());
  };
  const onPointerMove = (e: PointerEvent) => {
    const over = onScene(e) && onTent(e);
    if (over === tentHover) return;
    tentHover = over;
    document.body.style.cursor = over ? "pointer" : "";
    setTent();
  };
  const onPointerLeave = () => {
    tentHover = false;
    document.body.style.cursor = "";
    setTent();
  };
  // Tap the tent to keep its lantern on (phones have no hover); click open sky to send a shooting star.
  const onClick = (e: MouseEvent) => {
    if (!onScene(e)) return;
    if (onTent(e)) {
      tentLit = !tentLit;
      setTent();
      return;
    }
    if (!reduce) spawnMeteor(performance.now(), e.clientX, e.clientY);
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("click", onClick);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("click", onClick);
    document.body.style.cursor = "";
  };
}
