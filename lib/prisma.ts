import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Two runtimes, one `prisma` export:
//
//  • Node.js (local dev, `next start`): a single shared client, reused across
//    hot reloads.
//  • Cloudflare Workers: a connection may not be reused by a different request
//    ("Cannot perform I/O on behalf of a different request"), so each request
//    gets its own client, keyed by that request's ExecutionContext. If a
//    Hyperdrive binding named HYPERDRIVE exists it is used for pooling;
//    otherwise DATABASE_URL is used directly.

const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function createClient(connectionString: string, perRequest: boolean) {
  const adapter = new PrismaPg(
    perRequest
      ? // Short-lived pool owned by one request; never kept around for the next one.
        { connectionString, max: 5, idleTimeoutMillis: 0 }
      : { connectionString },
  );
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// --- Node: shared singleton ----------------------------------------------------
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function nodeClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
    globalForPrisma.prisma = createClient(url, false);
  }
  return globalForPrisma.prisma;
}

// --- Workers: one client per request ---------------------------------------------
const perRequest = new WeakMap<object, PrismaClient>();

function workersClient(): PrismaClient {
  // Request-scoped: ctx is the ExecutionContext of the request being served.
  const { env, ctx } = getCloudflareContext() as unknown as { env: Record<string, unknown>; ctx: object };
  let client = perRequest.get(ctx);
  if (!client) {
    const hyperdrive = env.HYPERDRIVE as { connectionString?: string } | undefined;
    const url = hyperdrive?.connectionString ?? (env.DATABASE_URL as string | undefined) ?? process.env.DATABASE_URL;
    if (!url) throw new Error("No database configured: set the DATABASE_URL secret or a HYPERDRIVE binding.");
    client = createClient(url, true);
    perRequest.set(ctx, client);
  }
  return client;
}

function current(): PrismaClient {
  return isWorkers ? workersClient() : nodeClient();
}

/**
 * Drop-in PrismaClient: every property access resolves the right client for the
 * current runtime/request, so call sites keep using `prisma.user.findMany(...)`.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = current();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
