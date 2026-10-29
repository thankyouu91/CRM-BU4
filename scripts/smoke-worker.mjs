import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

// Never point this smoke test at a production database or public Worker.
const database = new URL(process.env.TEST_DATABASE_URL ?? "http://invalid");
assert(["localhost", "127.0.0.1", "postgres"].includes(database.hostname) && database.pathname.endsWith("_test"), "A local TEST_DATABASE_URL ending in _test is required");
const origin = "http://127.0.0.1:8788";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.href }) });
const id = `worker-smoke-${randomUUID()}`;
const password = `${randomUUID()}Ab1`;
let server;
let logs = "";
try {
  await db.user.create({ data: { id, email: `${id}@example.test`, name: id, passwordHash: await hash(password, 12) } });
  const project = await db.project.create({ data: { name: id, ownerId: id, dueDate: new Date() } });
  await db.task.create({ data: { title: id, projectId: project.id, assigneeId: id, createdById: id, dueDate: new Date() } });
  server = spawn(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--ip", "127.0.0.1", "--port", "8788",
    "--config", ".release/worker/wrangler.json", "--var", "JWT_SECRET:worker-smoke-only-secret-at-least-32-characters", "--show-interactive-dev-session=false",
  ], {
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: database.href },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = (chunk) => { logs = (logs + chunk.toString()).slice(-16000); };
  server.stdout.on("data", log);
  server.stderr.on("data", log);
  server.on("error", log);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Wrangler exited with ${server.exitCode}`);
    try {
      const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1500) });
      ready = response.ok;
      if (ready) break;
    } catch { /* Wait for workerd to start. */ }
    await sleep(500);
  }
  assert(ready, "Worker did not start");
  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email: `${id}@example.test`, password }), signal: AbortSignal.timeout(20000),
  });
  assert.equal(login.status, 200, `Worker login failed: ${await login.text()}`);
  const cookie = login.headers.getSetCookie().find((item) => item.startsWith("crm_session="))?.split(";")[0];
  assert(cookie, "Worker did not issue a session");
  for (const [path, marker] of [["/projects", "Lịch hoạt động dự án"], ["/tasks", "Lịch công việc"], ["/reports", "Báo cáo công việc phòng"], ["/reports?view=analytics", "Bản trình chiếu"], ["/ai", "Đính kèm file"]]) {
    const response = await fetch(`${origin}${path}`, { headers: { Cookie: cookie }, redirect: "manual", signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, `${path} status`);
    const html = await response.text();
    assert(html.includes(marker) && !html.includes("a server-side exception"), `${path} server rendering failed`);
  }
  // A public presentation link opens without a session; an unknown one does not.
  const shareToken = randomBytes(32).toString("base64url");
  await db.deckShare.create({ data: { tokenHash: createHash("sha256").update(shareToken).digest("hex"), createdById: id, period: "month", projectId: project.id, expiresAt: new Date(Date.now() + 86_400_000) } });
  const shared = await fetch(`${origin}/share/${shareToken}`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
  assert.equal(shared.status, 200, "/share status");
  assert.equal(shared.headers.get("x-robots-tag"), "noindex, nofollow", "/share must not be indexed");
  assert.equal(shared.headers.get("referrer-policy"), "no-referrer", "/share must send no Referer");
  const sharedHtml = await shared.text();
  assert(sharedHtml.includes(`Báo cáo dự án ${id}`) && !sharedHtml.includes("a server-side exception"), "/share server rendering failed");
  const unknownShare = await fetch(`${origin}/share/${"A".repeat(43)}`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
  assert.equal(unknownShare.status, 404, "an unknown share link must not open");
  for (const deadline of ["this-week", "next-week", "next-month"]) {
    const response = await fetch(`${origin}/api/tasks?deadline=${deadline}&q=${id}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, `${deadline} API status`);
    const page = await response.json();
    assert.equal(page.deadline, deadline);
    if (deadline === "this-week") assert.equal(page.total, 1, "Fixture deadline should match this week");
  }
  const department = await fetch(`${origin}/api/reports/department?projectId=${project.id}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
  assert.equal(department.status, 200);
  const report = await department.json();
  assert.equal(report.sections.length, 3);
  assert.equal(report.counts.currentOpen, 1);
  const intake = await fetch(`${origin}/api/ai/intake`, {
    method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ attachments: [] }), signal: AbortSignal.timeout(20000),
  });
  assert.equal(intake.status, 400, "Intake must validate files inside workerd without calling AI");
  assert.equal((await intake.json()).fields.attachments, "Chọn file để trích xuất");
  // Pet Town: the game API and its Durable Object (SQLite) answer through the Worker; a member is
  // signed into the game on the /ta-tua page; the management board is for administrators only.
  const catalog = await fetch(`${origin}/ta-tua/api/catalog`, { signal: AbortSignal.timeout(20000) });
  assert.equal(catalog.status, 200, "/ta-tua/api/catalog status");
  const catalogData = await catalog.json();
  assert(catalogData.species.length > 0, "game catalog has species");
  assert.deepEqual(Object.keys(catalogData.gear?.tiers ?? {}), ["blue", "green", "gold", "red"], "game catalog lists the gear tiers");
  const play = await fetch(`${origin}/ta-tua`, { headers: { Cookie: cookie }, redirect: "manual", signal: AbortSignal.timeout(20000) });
  assert.equal(play.status, 200, "/ta-tua status");
  const playHtml = await play.text();
  const token = /\/ta-tua\/game\/(?:index\.html)?#token=([a-f0-9]+)/.exec(playHtml)?.[1];
  assert(token, `/ta-tua must embed the game with a play session: ${/Chưa vào chơi được.{0,300}/s.exec(playHtml)?.[0].replace(/<[^>]+>/g, " ") ?? playHtml.slice(0, 300)}`);
  const me = await fetch(`${origin}/ta-tua/api/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  assert.equal(me.status, 200, "the play session works against the Durable Object");
  const meData = await me.json();
  assert.equal(meData.user.coins, 150, "a new member gets the welcome coins");
  assert(Array.isArray(meData.gear), "the snapshot carries the player's gear");
  const redeem = await fetch(`${origin}/ta-tua/api/gifts/redeem`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ code: "KHONG-CO-MA" }), signal: AbortSignal.timeout(20000) });
  assert.equal(redeem.status, 400, "an unknown gift code is refused");
  assert.match((await redeem.json()).error, /Mã quà không đúng/, "gift code refusal message");
  const board = await fetch(`${origin}/api/ta-tua/admin/overview`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
  assert.equal(board.status, 403, "the management board is for administrators only");
  for (const path of ["gear-config", "gift-codes"]) {
    const res = await fetch(`${origin}/api/ta-tua/admin/${path}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
    assert.equal(res.status, 403, `board ${path} is for administrators only`);
  }
  // The game's internal API (SSO, management) is only reachable through the Durable Object stub.
  for (const path of ["/internal/health", "/ta-tua/internal/health", "/ta-tua/api/%2e%2e/internal/health", "/ta-tua/api/internal/health"]) {
    const response = await fetch(`${origin}${path}`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    assert(!(response.status === 200 && text.includes('"ok":true')), `the internal API must not be reachable at ${path}`);
  }
  // The park's WebSocket reaches the Durable Object: a valid play token connects, a bad one is refused.
  const park = async (playToken) => {
    const ws = new WebSocket(`${origin.replace(/^http/, "ws")}/ta-tua/ws`);
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("park WebSocket timed out")), 15000);
        ws.addEventListener("open", () => ws.send(JSON.stringify(["auth", { token: playToken }])));
        ws.addEventListener("message", (event) => {
          clearTimeout(timer);
          resolve(JSON.parse(event.data)[0]);
        });
        ws.addEventListener("error", () => reject(new Error("park WebSocket failed")));
      });
    } finally {
      ws.close();
    }
  };
  assert.equal(await park(token), "connect", "a play session opens the park");
  assert.equal(await park("not-a-token"), "connect_error", "the park refuses a bad token");
  // The game's own domain shows only the game: WorkHub pages go to the play page, WorkHub APIs are not there.
  // (fetch drops a custom Host header, so these go through node:http)
  const onPlayHost = (path) => new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { headers: { Host: "play.petfarm.online", Cookie: cookie }, timeout: 20000 }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location ?? "" });
    });
    req.on("error", reject);
    req.end();
  });
  const playRoot = await onPlayHost("/dashboard");
  assert.equal(playRoot.status, 307, "game domain: WorkHub pages redirect");
  assert(playRoot.location.endsWith("/server1"), "game domain: to the play page");
  const playApi = await onPlayHost("/api/projects");
  assert.equal(playApi.status, 404, "game domain: no WorkHub API");
  const play1 = await fetch(`${origin}/server1`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
  assert(/\/ta-tua\/game\/(?:index\.html)?#token=[a-f0-9]+/.test(await play1.text()), "/server1 signs a member in");
  const invite = await fetch(`${origin}/invitation/deadbeef00`, { signal: AbortSignal.timeout(20000) });
  assert((await invite.text()).includes("Link mời này không còn hiệu lực"), "/invitation renders");
  const oldInvite = await fetch(`${origin}/ta-tua/khach/deadbeef00`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
  assert.equal(oldInvite.headers.get("location"), "https://play.petfarm.online/invitation/deadbeef00", "old invite links move to the game domain");
  // Name + password accounts (scrypt inside the Durable Object): sign up, sign in, and an existing member adds a password.
  const account = (body) =>
    fetch(`${origin}/api/ta-tua/account`, { method: "POST", headers: { "content-type": "application/json", Origin: origin }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }).then(async (res) => ({ status: res.status, data: await res.json() }));
  const smokeName = `Smoke_${Date.now().toString(36)}`;
  const signup = await account({ action: "register", username: smokeName, password: "smoke-pass" });
  assert.equal(signup.status, 200, `sign-up: ${JSON.stringify(signup.data)}`);
  assert(signup.data.token && signup.data.hasPassword, "sign-up returns a play session");
  const signin = await account({ action: "login", username: smokeName, password: "smoke-pass" });
  assert.equal(signin.data.userId, signup.data.userId, "sign-in finds the same account");
  assert.equal((await account({ action: "login", username: smokeName, password: "wrong-pass" })).status, 400, "wrong password refused");
  const memberSet = await account({ action: "credentials", token, username: `${smokeName}m`, password: "smoke-pass" });
  assert.equal(memberSet.data.hasPassword, true, `member adds a password: ${JSON.stringify(memberSet.data)}`);
  const noPassword = await account({ action: "login", username: `${smokeName}x`, password: "" });
  assert.equal(noPassword.status, 400, "login with an empty password for an unknown name is refused");
  const setupPage = await fetch(`${origin}/password/${"0".repeat(32)}`, { signal: AbortSignal.timeout(20000) });
  assert((await setupPage.text()).includes("đã dùng rồi hoặc đã hết hạn"), "/password/<code> renders");
  assert.equal((await onPlayHost(`/password/${"0".repeat(32)}`)).status, 200, "game domain serves the password link page");
  const gameDir = await fetch(`${origin}/ta-tua/game/`, { signal: AbortSignal.timeout(20000) });
  assert.equal(gameDir.status, 200, "game page is served at its folder path (no redirect)");
  const gamePage = await fetch(`${origin}/ta-tua/game/index.html`, { signal: AbortSignal.timeout(20000) });
  assert.equal(gamePage.status, 200, "game page is served as a static asset");
  console.log("Worker smoke passed: login, project calendar, My Tasks, public share link, deadline APIs, department report, analytics, AI intake route and Pet Town (game API, Durable Object, sign-in, name + password accounts, gear and gift codes, park WebSocket) on workerd + PostgreSQL.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server?.kill("SIGTERM");
  await db.project.deleteMany({ where: { ownerId: id } });
  await db.user.deleteMany({ where: { id } });
  await db.$disconnect();
}
