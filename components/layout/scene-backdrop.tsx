"use client";

import { useEffect, useState } from "react";
import { dawnScene } from "./scene-dawn";
import { nightScene } from "./scene-night";

/**
 * The app's backdrop: one fixed canvas behind the shell, drawn with plain
 * Canvas 2D (nothing fetched). The dark theme shows a night sky with the Milky
 * Way (scene-night.ts); the light theme a valley at dawn (scene-dawn.ts). Both
 * share this engine: the seeded randomness, the ridges and pines, the tent and
 * its lantern, the 30 fps loop that pauses while the tab is hidden, the
 * debounced rebuild on resize and the still frame under reduced motion.
 *
 * Mounted once in the shell, so it survives route changes; when the theme
 * flips, the running scene is torn down and the other one starts on the same
 * canvas. `data-scene` on <html> lets globals.css make the page, the sidebar,
 * the header and the cards translucent so the scene shows through. The sign-in
 * page has its own backdrop and does not use this.
 */
export function SceneBackdrop() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const [host, setHost] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (dark === null || !host) return;
    document.documentElement.setAttribute("data-scene", dark ? "night" : "dawn");
    const stop = startScene(host, dark ? nightScene : dawnScene);
    return () => {
      stop();
      document.documentElement.removeAttribute("data-scene");
    };
  }, [dark, host]);
  return <canvas ref={setHost} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full print:hidden" />;
}

export type Rng = () => number;
export type Noise = (x: number, octaves?: number) => number;
export type Layer = [HTMLCanvasElement, CanvasRenderingContext2D];
export interface Tent {
  x: number;
  y: number;
  w: number;
  /** On phones the tent sits on the middle ridge, so the near ridge is drawn over it. */
  onMid: boolean;
}

/** What a scene gets to build and draw with. */
export interface SceneEnv {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  DPR: number;
  narrow: boolean;
  reduce: boolean;
  /** Seeded, reset on every build: the same scene comes back on every visit. */
  R: Rng;
  gauss(): number;
  noise(): Noise;
  /** An offscreen canvas at device resolution, scaled so CSS pixels can be used. */
  layer(w?: number, h?: number): Layer;
  /** A hill: noisy skyline filled down to the bottom; returns the skyline height at x. */
  ridge(g: CanvasRenderingContext2D, baseY: number, amp: number, freq: number, fill: string | CanvasGradient): (x: number) => number;
  /** A row of pines along a skyline, as one filled path; `clear` leaves a gap for the tent. */
  pines(g: CanvasRenderingContext2D, yAt: (x: number) => number, step: () => number, height: () => number, color: string, skip?: number, clear?: number): void;
  /** Tent on the near ridge at desktop width, on the highest point of the middle ridge on phones. */
  placeTent(midY: (x: number) => number, nearY: (x: number) => number): Tent;
  /** Set by the scene's build; the engine uses it for hover and taps. */
  tent: Tent | null;
}

export interface Frame {
  /** seconds since the scene started */
  t: number;
  /** performance.now() */
  now: number;
  /** seconds since the previous frame, capped */
  dt: number;
  /** the tent's lantern, 0 at rest and 1 when pointed at or tapped, eased */
  glow: number;
}

export interface Scene {
  /** (Re)builds the still layers at the current size; must set env.tent. */
  build(env: SceneEnv): void;
  /** Draws one full frame. With env.reduce it must be a still picture. */
  draw(env: SceneEnv, f: Frame): void;
  /** A click on open scene (not on a card or control, not on the tent). */
  tap?(env: SceneEnv, x: number, y: number, now: number): void;
}

export const DPR_MAX = 1.5; // sharp enough, far cheaper on retina screens
export const FPS = 30; // the scenes move slowly; 30 frames look the same as 60
const SEED = 20261029;

/** Elements the scene does not show through: pointer events over them are not scene or tent. */
const COVER = "aside, header, nav, .bg-card, button, a, input, select, textarea, label, table, [role='dialog'], [role='menu'], [role='listbox']";

export const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",");
export const bump = (t: number, c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));

/** A soft radial spot; `squash` flattens it into a wisp. */
export function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number, squash = 1) {
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, r);
  rg.addColorStop(0, `rgba(${rgb},${a})`);
  rg.addColorStop(1, `rgba(${rgb},0)`);
  g.save();
  g.translate(x, y);
  if (squash !== 1) g.scale(1, squash);
  g.fillStyle = rg;
  g.fillRect(-r, -r, 2 * r, 2 * r);
  g.restore();
}

export function tentPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.lineTo(x, y - h);
  g.lineTo(x + w / 2, y);
  g.closePath();
}

function startScene(canvas: HTMLCanvasElement, scene: Scene): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, DPR_MAX);

  // ---- randomness and noise ----
  const rng = (a: number): Rng => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const env: SceneEnv = {
    ctx,
    W: 0,
    H: 0,
    DPR,
    narrow: false,
    reduce,
    R: rng(SEED),
    tent: null,
    gauss() {
      let u = 0;
      while (!u) u = env.R();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * env.R());
    },
    noise() {
      const p = Array.from({ length: 256 }, () => env.R());
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
    },
    layer(w = env.W, h = env.H) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * DPR));
      c.height = Math.max(1, Math.round(h * DPR));
      const g = c.getContext("2d")!;
      g.scale(DPR, DPR);
      return [c, g];
    },
    ridge(g, baseY, amp, freq, fill) {
      const nz = env.noise();
      const yAt = (x: number) => baseY - amp * nz(x * freq, 5);
      g.beginPath();
      g.moveTo(0, env.H);
      for (let x = 0; x <= env.W + 4; x += 3) g.lineTo(x, yAt(x));
      g.lineTo(env.W, env.H);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      return yAt;
    },
    pines(g, yAt, step, height, color, skip = 0, clear) {
      g.fillStyle = color;
      g.beginPath();
      for (let x = env.R() * 8; x < env.W; x += step()) {
        if (skip && env.R() < skip) continue;
        if (clear && Math.abs(x - clear) < 40) continue;
        const h = height();
        const y = yAt(x) + 3;
        for (let k = 0; k < 3; k++) {
          const top = y - h + k * h * 0.28;
          const half = h * (0.16 + k * 0.07);
          g.moveTo(x, top);
          g.lineTo(x - half, top + h * 0.42);
          g.lineTo(x + half, top + h * 0.42);
        }
        g.rect(x - h * 0.03, y - h * 0.12, h * 0.06, h * 0.14);
      }
      g.fill();
    },
    placeTent(midY, nearY) {
      let x = env.W * 0.45;
      if (env.narrow) for (let k = env.W * 0.55; k <= env.W * 0.85; k += 4) if (midY(k) < midY(x)) x = k;
      return { x, y: (env.narrow ? midY : nearY)(x) + 3, w: env.narrow ? 26 : 34, onMid: env.narrow };
    },
  };

  let glow = 0;
  let target = 0;
  let hover = false;
  let lit = false;
  let raf = 0;
  let last = 0;
  let prev = 0;
  const start = performance.now();

  function build() {
    env.W = window.innerWidth;
    env.H = window.innerHeight;
    env.narrow = env.W < 640;
    canvas.width = Math.round(env.W * DPR);
    canvas.height = Math.round(env.H * DPR);
    env.R = rng(SEED);
    env.tent = null;
    scene.build(env);
  }

  function draw(now: number) {
    const dt = prev ? Math.min((now - prev) / 1000, 0.1) : 0;
    prev = now;
    glow = reduce ? target : glow + (target - glow) * 0.12;
    ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    scene.draw(env, { t: (now - start) / 1000, now, dt, glow });
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
  const onTent = (e: PointerEvent | MouseEvent) => {
    const t = env.tent;
    return !!t && Math.hypot(e.clientX - t.x, e.clientY - (t.y - t.w * 0.3)) < t.w * 1.1;
  };
  const setTent = () => {
    target = hover || lit ? 1 : 0;
    if (reduce) draw(performance.now());
  };
  const onPointerMove = (e: PointerEvent) => {
    const over = onScene(e) && onTent(e);
    if (over === hover) return;
    hover = over;
    document.body.style.cursor = over ? "pointer" : "";
    setTent();
  };
  const onPointerLeave = () => {
    hover = false;
    document.body.style.cursor = "";
    setTent();
  };
  // Tap the tent to keep its lantern on (phones have no hover); a click on open scene goes to the scene.
  const onClick = (e: MouseEvent) => {
    if (!onScene(e)) return;
    if (onTent(e)) {
      lit = !lit;
      setTent();
      return;
    }
    if (!reduce) scene.tap?.(env, e.clientX, e.clientY, performance.now());
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
