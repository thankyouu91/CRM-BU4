import { blob, bump, mix, tentPath, type Frame, type Scene, type SceneEnv } from "./scene-backdrop";

/**
 * The dark theme's scene: a night sky with the Milky Way, three wooded ridges
 * and a small tent. Sky and land are built once to offscreen canvases; a frame
 * is one drawImage of the sky (with a slow sway), the twinkling stars, any
 * meteors, the land and the tent. Pointing at the tent turns its lantern up;
 * tapping toggles it; a click on open sky sends a shooting star.
 */

interface Twinkle { x: number; y: number; r: number; a: number; f: number; p: number; c: string }
interface Meteor { x: number; y: number; born: number; vx: number; vy: number; speed: number; len: number; life: number }

const MARGIN = 0.18; // sky drawn larger than the screen so its slow sway never shows an edge
const TINTS = ["255,255,255", "205,218,255", "255,232,200", "190,205,255"];

let sky: HTMLCanvasElement;
let land: HTMLCanvasElement;
let twinkles: Twinkle[] = [];
let meteors: Meteor[] = [];
let nextMeteor = 0;
let sprites: Record<string, HTMLCanvasElement> | null = null;

function makeSprite(rgb: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  blob(g, 32, 32, 32, rgb, 0.55);
  blob(g, 32, 32, 6, "255,255,255", 1);
  return c;
}

// ---- the sky: gradient, Milky Way glow, band stars, dust lanes, field stars (drawn once) ----
function buildSky(env: SceneEnv) {
  const { W, H, R, narrow } = env;
  const SW = W * (1 + 2 * MARGIN);
  const SH = H * (1 + 2 * MARGIN);
  const ox = W * MARGIN;
  const oy = H * MARGIN;
  const [c, s] = env.layer(SW, SH);
  sky = c;

  const g = s.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, "#020309");
  g.addColorStop(0.5, "#050918");
  g.addColorStop(0.8, "#0b142b");
  g.addColorStop(1, "#14223d");
  s.fillStyle = g;
  s.fillRect(0, 0, SW, SH);

  // The band rises from behind the hills at lower left to the top right; its bright core sits low, as in summer skies.
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
  const laneNoise = env.noise();
  const gapNoise = env.noise();

  s.globalCompositeOperation = "lighter";
  for (let i = 0; i < 1100; i++) {
    const t = R() * 1.1 - 0.05;
    const w = width(t);
    const off = env.gauss() * w * 0.45;
    const [x, y] = at(t, off);
    const k = bump(t, core, 0.25);
    const fall = Math.max(0, 1 - Math.abs(off) / (w * 1.4));
    blob(s, x, y, w * (0.35 + R() * 0.7), mix(cool, warm, k), 0.017 * bright(t) * fall + 0.003);
  }
  // faint hydrogen-pink and teal clouds along the band
  for (let i = 0; i < 18; i++) {
    const t = 0.1 + R() * 0.6;
    const w = width(t);
    const [x, y] = at(t, env.gauss() * w * 0.4);
    blob(s, x, y, w * (0.12 + R() * 0.2), R() < 0.7 ? "255,105,150" : "90,210,200", 0.035 + R() * 0.03);
  }
  // stars packed into the band
  const want = Math.min(90000, Math.round((W * H) / 20));
  for (let n = 0, tries = 0; n < want && tries < want * 4; tries++) {
    const t = R() * 1.08 - 0.04;
    if (R() > bright(t) / 1.17) continue;
    n++;
    const w = width(t);
    const [x, y] = at(t, env.gauss() * w * 0.42);
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
    const off = (laneNoise(t * 5) - 0.5) * w * 0.7 + env.gauss() * w * 0.12;
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
function buildLand(env: SceneEnv) {
  const { W, H, R, narrow } = env;
  const [c, l] = env.layer();
  land = c;

  const hg = l.createLinearGradient(0, H * 0.45, 0, H);
  hg.addColorStop(0, "rgba(40,70,110,0)");
  hg.addColorStop(0.5, "rgba(70,105,140,0.16)");
  hg.addColorStop(0.72, "rgba(245,170,115,0.13)");
  hg.addColorStop(1, "rgba(245,170,115,0)");
  l.fillStyle = hg;
  l.fillRect(0, 0, W, H);

  const farFill = l.createLinearGradient(0, H * 0.55, 0, H * 0.85);
  farFill.addColorStop(0, "#1e2947");
  farFill.addColorStop(1, "#111a31");
  env.ridge(l, H * 0.78, H * 0.2, 1 / 260, farFill);
  const mist = l.createLinearGradient(0, H * 0.68, 0, H * 0.84);
  mist.addColorStop(0, "rgba(130,160,200,0)");
  mist.addColorStop(1, "rgba(130,160,200,0.10)");
  l.fillStyle = mist;
  l.fillRect(0, H * 0.68, W, H * 0.16);

  const midY = env.ridge(l, H * 0.86, H * 0.13, 1 / 170, "#0a1021");
  env.pines(l, midY, () => 4 + R() * 9, () => (7 + R() * 14) * (narrow ? 0.8 : 1), "#0a1021", 0.12);

  const nearY = env.ridge(l, H * 0.97, H * 0.1, 1 / 130, "#03050b");
  const tent = env.placeTent(midY, nearY);
  // a dense row of pines on the near ridge, with a small clearing for the tent
  env.pines(l, nearY, () => 3 + R() * 8, () => (14 + R() * 36) * (R() > 0.85 ? 1.3 : 1) * (narrow ? 0.7 : 1), "#03050b", 0, tent.onMid ? undefined : tent.x);
  env.tent = tent;
}

// ---- the tent: dimly lit at rest; pointing at it (or tapping it) turns the lantern up ----
function drawTent(env: SceneEnv, f: Frame) {
  const { ctx, tent, reduce } = env;
  if (!tent) return;
  const { x, y, w } = tent;
  const h = w * 0.66;
  const k = f.glow;
  const flicker = reduce ? 1 : 0.94 + 0.04 * Math.sin(f.t * 7.3) + 0.02 * Math.sin(f.t * 13.1);
  ctx.globalCompositeOperation = "lighter";
  blob(ctx, x, y - 8, 55 + 75 * k, "255,165,90", (0.09 + 0.3 * k) * flicker);
  if (k > 0.02) blob(ctx, x, y - h * 0.3, 18 + 10 * k, "255,220,160", 0.45 * k * flicker);
  ctx.globalCompositeOperation = "source-over";
  // dim canvas, then the lit canvas faded in over it
  const dim = ctx.createLinearGradient(x, y - h, x, y);
  dim.addColorStop(0, "#9c7650");
  dim.addColorStop(1, "#5e3417");
  ctx.fillStyle = dim;
  tentPath(ctx, x, y, w, h);
  ctx.fill();
  ctx.globalAlpha = k * flicker;
  const lit = ctx.createLinearGradient(x, y - h, x, y);
  lit.addColorStop(0, "#fff0cf");
  lit.addColorStop(1, "#e8873e");
  ctx.fillStyle = lit;
  tentPath(ctx, x, y, w, h);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = k > 0.5 ? "#4a230b" : "#1f0f05";
  tentPath(ctx, x, y, w * 0.24, h * 0.55);
  ctx.fill();
}

// ---- shooting stars ----
function spawnMeteor(env: SceneEnv, now: number, x?: number, y?: number) {
  const { W, H, R } = env;
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
function drawMeteors(env: SceneEnv, now: number) {
  const { ctx } = env;
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
    ctx.drawImage(sprites!["255,255,255"], hx - 6, hy - 6, 12, 12);
  }
  ctx.globalCompositeOperation = "source-over";
}

export const nightScene: Scene = {
  build(env) {
    if (!sprites) {
      sprites = {};
      for (const c of TINTS) sprites[c] = makeSprite(c);
    }
    buildSky(env);
    buildLand(env);
    meteors = [];
    nextMeteor = performance.now() + 2500;
  },

  // ---- one frame: sky (slow sway around a point below the horizon), twinkles, meteors, then the still ground ----
  draw(env, f) {
    const { ctx, W, H, R, reduce } = env;
    const ang = reduce ? 0 : Math.sin((f.t * 2 * Math.PI) / 300) * 0.035;
    const px = W * 0.5;
    const py = H * 1.5;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.translate(-px, -py);
    ctx.drawImage(sky, -W * MARGIN, -H * MARGIN, W * (1 + 2 * MARGIN), H * (1 + 2 * MARGIN));
    ctx.globalCompositeOperation = "lighter";
    for (const s of twinkles) {
      ctx.globalAlpha = reduce ? s.a : s.a * (0.5 + 0.5 * Math.sin(f.t * s.f + s.p));
      ctx.drawImage(sprites![s.c], s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
    if (!reduce && f.now > nextMeteor) {
      spawnMeteor(env, f.now);
      nextMeteor = f.now + 4500 + R() * 7500;
    }
    if (meteors.length) drawMeteors(env, f.now);
    ctx.drawImage(land, 0, 0, W, H);
    drawTent(env, f);
  },

  tap(env, x, y, now) {
    spawnMeteor(env, now, x, y);
  },
};
