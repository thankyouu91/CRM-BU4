// Retro Diffusion (pixel art) from the command line. It has no MCP server, so Claude sessions call its API through this.
// The key is read from RETRO_DIFFUSION_API_KEY and never printed.
//
//   node scripts/retro-diffusion.mjs credits
//   node scripts/retro-diffusion.mjs generate --style rd_tile__tileset --size 32x32 --prompt "grass to dirt path" --out tmp/art
//     [--n 4] [--input ref.png] [--strength 0.75] [--palette palette.png] [--seed 1] [--tile] [--remove-bg]
//     [--spritesheet] [--frames 8] [--cost]   (--cost asks the price without spending credits)
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const API = "https://api.retrodiffusion.ai/v2/inferences";
const key = process.env.RETRO_DIFFUSION_API_KEY;
if (!key) {
  console.error("RETRO_DIFFUSION_API_KEY is not set. Add it to the cloud environment's secrets, then start a new session.");
  process.exit(1);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    style: { type: "string" },
    size: { type: "string" },
    prompt: { type: "string" },
    n: { type: "string", default: "1" },
    input: { type: "string" },
    strength: { type: "string" },
    palette: { type: "string" },
    seed: { type: "string" },
    tile: { type: "boolean", default: false },
    "remove-bg": { type: "boolean", default: false },
    spritesheet: { type: "boolean", default: false },
    frames: { type: "string" },
    cost: { type: "boolean", default: false },
    out: { type: "string", default: "tmp/retro-diffusion" },
  },
});

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { "X-RD-Token": key, "Content-Type": "application/json", ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

const b64 = async (path) => (await readFile(path)).toString("base64");

async function generate() {
  const [width, height] = (values.size ?? "").split("x").map(Number);
  if (!values.style || !width || !height) throw new Error("--style and --size WxH are required");
  const body = {
    prompt_style: values.style,
    width,
    height,
    num_images: Number(values.n),
    ...(values.prompt && { prompt: values.prompt }),
    ...(values.input && { input_image: await b64(values.input) }),
    ...(values.strength && { strength: Number(values.strength) }),
    ...(values.palette && { input_palette: await b64(values.palette) }),
    ...(values.seed && { seed: Number(values.seed) }),
    ...(values.tile && { tile_x: true, tile_y: true }),
    ...(values["remove-bg"] && { remove_bg: true }),
    ...(values.spritesheet && { return_spritesheet: true }),
    ...(values.frames && { frames_duration: Number(values.frames) }),
    ...(values.cost && { check_cost: true }),
  };
  let reply = await call(API, { method: "POST", body: JSON.stringify(body), headers: values.cost ? {} : { "Idempotency-Key": randomUUID() } });
  if (values.cost) return console.log(JSON.stringify(reply, null, 2));
  for (let wait = 2000; reply.task_id && ["pending", "running", "queued"].includes(String(reply.status).toLowerCase()); wait = Math.min(wait * 1.5, 10_000)) {
    await sleep(wait);
    reply = await call(`${API}/tasks/${reply.task_id}`);
  }
  const result = reply.result ?? reply;
  const images = result.base64_images ?? [];
  if (!images.length) throw new Error(`No images returned: ${JSON.stringify(reply).slice(0, 500)}`);
  await mkdir(values.out, { recursive: true });
  const stamp = Date.now();
  for (const [i, data] of images.entries()) {
    const buf = Buffer.from(data, "base64");
    const ext = buf.subarray(0, 3).toString("ascii") === "GIF" ? "gif" : "png";
    const file = join(values.out, `${values.style}-${stamp}-${i}.${ext}`);
    await writeFile(file, buf);
    console.log(file);
  }
  console.log(`cost ${result.balance_cost ?? "?"}, remaining ${result.remaining_balance ?? "?"}`);
}

try {
  if (positionals[0] === "credits") console.log(JSON.stringify(await call(`${API}/credits`)));
  else if (positionals[0] === "generate") await generate();
  else throw new Error("usage: retro-diffusion.mjs credits | generate --style S --size WxH [...]");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
