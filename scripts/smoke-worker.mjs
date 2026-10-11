import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
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
  for (const [path, marker] of [["/projects", "Lịch hoạt động dự án"], ["/tasks", "Deadline công việc"]]) {
    const response = await fetch(`${origin}${path}`, { headers: { Cookie: cookie }, redirect: "manual", signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, `${path} status`);
    const html = await response.text();
    assert(html.includes(marker) && !html.includes("a server-side exception"), `${path} server rendering failed`);
  }
  for (const deadline of ["this-week", "next-week", "next-month"]) {
    const response = await fetch(`${origin}/api/tasks?deadline=${deadline}&q=${id}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, `${deadline} API status`);
    const page = await response.json();
    assert.equal(page.deadline, deadline);
    if (deadline === "this-week") assert.equal(page.total, 1, "Fixture deadline should match this week");
  }
  console.log("Worker smoke passed: login, project calendar, My Tasks and all three deadline APIs on workerd + PostgreSQL.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server?.kill("SIGTERM");
  await db.project.deleteMany({ where: { ownerId: id } });
  await db.user.deleteMany({ where: { id } });
  await db.$disconnect();
}
