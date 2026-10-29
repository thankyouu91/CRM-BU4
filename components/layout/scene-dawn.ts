import { blob, tentPath, type Frame, type Scene, type SceneEnv } from "./scene-backdrop";

/**
 * The light theme's scene: a valley at dawn. The sun rises behind the far
 * ridge, mist drifts through the two valleys, flocks of birds cross the sky now
 * and then, and the tent's fire sends up a thread of smoke when the lantern is
 * on. Sky, ridges and mist strips are built once to offscreen canvases; a frame
 * layers them with the moving parts between. Pointing at the tent lights it;
 * tapping toggles it; a click on open sky startles a few birds into the air.
 */

interface Bird { x: number; y: number; vx: number; vy: number; size: number; flap: number; phase: number }
interface Puff { x: number; y: number; r: number; a: number; vx: number; life: number }
interface Mist { y: number; h: number; speed: number; alpha: number; img: HTMLCanvasElement }

let sky: HTMLCanvasElement;
let far: HTMLCanvasElement;
let mid: HTMLCanvasElement;
let near: HTMLCanvasElement;
let mists: Mist[] = [];
let birds: Bird[] = [];
let puffs: Puff[] = [];
let nextFlock = 0;
let nextPuff = 0;

// ---- the sky: gradient, the low sun, thin wisps of cloud (drawn once) ----
function buildSky(env: SceneEnv) {
  const { W, H, R, narrow } = env;
  const [c, s] = env.layer();
  sky = c;
  const g = s.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#cddbec");
  g.addColorStop(0.42, "#e4ebf3");
  g.addColorStop(0.62, "#f6e6da");
  g.addColorStop(0.78, "#fbe9cf");
  g.addColorStop(1, "#f7e2c4");
  s.fillStyle = g;
  s.fillRect(0, 0, W, H);

  const sx = W * (narrow ? 0.3 : 0.7);
  const sy = H * 0.68;
  const big = Math.max(W, H);
  blob(s, sx, sy, big * 0.55, "255,214,170", 0.45);
  blob(s, sx, sy, big * 0.18, "255,236,205", 0.7);
  blob(s, sx, sy, big * 0.05, "255,250,236", 0.9);

  for (let i = 0; i < 14; i++) {
    blob(s, R() * W, H * (0.08 + R() * 0.4), W * (0.08 + R() * 0.16), R() < 0.5 ? "255,255,255" : "255,226,220", 0.22 + R() * 0.2, 0.12 + R() * 0.08);
  }
}

// ---- the ridges, each on its own layer so mist can drift between them ----
function buildLand(env: SceneEnv) {
  const { W, H, R, narrow } = env;

  const [fc, f] = env.layer();
  far = fc;
  const farFill = f.createLinearGradient(0, H * 0.56, 0, H * 0.8);
  farFill.addColorStop(0, "#b7c3d3");
  farFill.addColorStop(1, "#c9d1da");
  env.ridge(f, H * 0.78, H * 0.2, 1 / 260, farFill);

  const [mc, m] = env.layer();
  mid = mc;
  const midY = env.ridge(m, H * 0.86, H * 0.13, 1 / 170, "#8597aa");
  env.pines(m, midY, () => 4 + R() * 9, () => (7 + R() * 14) * (narrow ? 0.8 : 1), "#7b8ea3", 0.12);

  const [nc, n] = env.layer();
  near = nc;
  const nearY = env.ridge(n, H * 0.97, H * 0.1, 1 / 130, "#3c5148");
  const tent = env.placeTent(midY, nearY);
  env.pines(n, nearY, () => 3 + R() * 8, () => (14 + R() * 36) * (R() > 0.85 ? 1.3 : 1) * (narrow ? 0.7 : 1), "#33463e", 0, tent.onMid ? undefined : tent.x);
  env.tent = tent;

  // Two strips of mist, each a seamless band twice the screen wide that scrolls and wraps.
  mists = [
    { y: H * 0.66, h: H * 0.2, speed: 5, alpha: 0.5 },
    { y: H * 0.77, h: H * 0.16, speed: 9, alpha: 0.42 },
  ].map((strip) => {
    const [img, g] = env.layer(W * 2, strip.h);
    for (let i = 0; i < 70; i++) {
      const x = R() * W * 2;
      const y = strip.h * (0.3 + R() * 0.4);
      const r = W * (0.06 + R() * 0.12);
      for (const dx of [0, -2 * W, 2 * W]) blob(g, x + dx, y, r, "255,255,255", 0.5, 0.22);
    }
    return { ...strip, img };
  });
}

// ---- birds: a flock crosses now and then; a click on the sky startles a few up ----
function spawnFlock(env: SceneEnv) {
  const { W, H, R } = env;
  const n = 5 + Math.floor(R() * 6);
  const y0 = H * (0.12 + R() * 0.28);
  const speed = 45 + R() * 30;
  const size = 4 + R() * 3;
  const flap = 5 + R() * 3;
  const fromLeft = R() < 0.5;
  for (let i = 0; i < n; i++) {
    const row = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
    birds.push({
      x: fromLeft ? -40 - Math.abs(row) * size * 3 : W + 40 + Math.abs(row) * size * 3,
      y: y0 + row * size * 1.6 + (R() - 0.5) * size,
      vx: fromLeft ? speed : -speed,
      vy: 0,
      size,
      flap,
      phase: R() * 6.28,
    });
  }
}
function scatterFrom(env: SceneEnv, x: number, y: number) {
  const { R } = env;
  const n = 3 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const speed = 90 + R() * 70;
    const ang = -Math.PI / 2 + (R() - 0.5) * 1.6;
    birds.push({ x: x + (R() - 0.5) * 30, y: y + (R() - 0.5) * 20, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, size: 4 + R() * 3, flap: 9 + R() * 4, phase: R() * 6.28 });
  }
}
function drawBirds(env: SceneEnv, f: Frame) {
  const { ctx, W } = env;
  birds = birds.filter((b) => b.x > -120 && b.x < W + 120 && b.y > -80);
  if (!birds.length) return;
  ctx.strokeStyle = "rgba(40,50,66,0.72)";
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const b of birds) {
    b.x += b.vx * f.dt;
    b.y += b.vy * f.dt;
    const lift = Math.sin(f.t * b.flap + b.phase) * b.size * 0.7;
    ctx.moveTo(b.x - b.size, b.y - lift);
    ctx.quadraticCurveTo(b.x - b.size * 0.45, b.y + b.size * 0.25, b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.size * 0.45, b.y + b.size * 0.25, b.x + b.size, b.y - lift);
  }
  ctx.stroke();
}

// ---- the tent and its fire: dark at rest; pointing at it (or tapping it) lights the door and starts the smoke ----
function drawTent(env: SceneEnv, f: Frame) {
  const { ctx, tent, reduce, R } = env;
  if (!tent) return;
  const { x, y, w } = tent;
  const h = w * 0.66;
  const k = f.glow;
  const body = ctx.createLinearGradient(x, y - h, x, y);
  body.addColorStop(0, "#f1b578");
  body.addColorStop(1, "#b9662c");
  ctx.fillStyle = body;
  tentPath(ctx, x, y, w, h);
  ctx.fill();
  ctx.fillStyle = "#5a2e12";
  tentPath(ctx, x, y, w * 0.24, h * 0.55);
  ctx.fill();
  if (k > 0.01) {
    ctx.globalAlpha = k;
    ctx.fillStyle = "#ffcf7a";
    tentPath(ctx, x, y, w * 0.16, h * 0.38);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // smoke from the fire beside the tent
  const fx = x + w * 0.08;
  const fy = y - h;
  if (reduce) {
    if (k > 0.5) for (let i = 0; i < 6; i++) blob(ctx, fx + Math.sin(i * 1.7) * 3, fy - 6 - i * 11, (3 + i * 2.6) * 1.6, "120,126,138", 0.3 - i * 0.045);
    return;
  }
  if (k > 0.05 && f.now > nextPuff) {
    puffs.push({ x: fx, y: fy, r: 3, a: 0.32 * k, vx: (R() - 0.5) * 6, life: 0 });
    nextPuff = f.now + 140 + R() * 120;
  }
  for (const p of puffs) {
    p.life += f.dt;
    p.y -= 16 * f.dt;
    p.x += p.vx * f.dt;
    p.r += 3.2 * f.dt;
    p.a *= 1 - 0.32 * f.dt;
    blob(ctx, p.x, p.y, p.r * 1.6, "120,126,138", p.a);
  }
  puffs = puffs.filter((p) => p.a > 0.01 && p.life < 9);
}

export const dawnScene: Scene = {
  build(env) {
    buildSky(env);
    buildLand(env);
    birds = [];
    puffs = [];
    nextFlock = performance.now() + 2000;
    nextPuff = 0;
  },

  // ---- one frame: sky, far ridge, mist, middle ridge, mist, near ridge, with the tent on its ridge and birds in front ----
  draw(env, f) {
    const { ctx, W, H, R, reduce, tent } = env;
    ctx.drawImage(sky, 0, 0, W, H);
    ctx.drawImage(far, 0, 0, W, H);
    const mist = (m: Mist) => {
      const off = reduce ? 0 : (f.t * m.speed) % (2 * W);
      ctx.globalAlpha = m.alpha;
      ctx.drawImage(m.img, -off, m.y, 2 * W, m.h);
      ctx.drawImage(m.img, 2 * W - off, m.y, 2 * W, m.h);
      ctx.globalAlpha = 1;
    };
    mist(mists[0]);
    ctx.drawImage(mid, 0, 0, W, H);
    if (tent?.onMid) drawTent(env, f);
    mist(mists[1]);
    ctx.drawImage(near, 0, 0, W, H);
    if (tent && !tent.onMid) drawTent(env, f);
    if (reduce) return;
    if (f.now > nextFlock) {
      spawnFlock(env);
      nextFlock = f.now + 14000 + R() * 16000;
    }
    drawBirds(env, f);
  },

  tap(env, x, y) {
    if (y < env.H * 0.9) scatterFrom(env, x, y);
  },
};
