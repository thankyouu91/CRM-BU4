import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client, Pool, type PoolClient } from "pg";
import { databaseUrl, isWorkers } from "./prisma";

// Bytes of uploaded files, by key (the ContractFile id); the metadata stays in
// Prisma models.
//
//  • Cloudflare Workers with the CONTRACT_FILES binding: bytes live in R2 under
//    "contract-files/<key>". Files uploaded before R2 (still in Postgres,
//    "ContractFileBlob") move to R2 the first time they are opened.
//  • Otherwise (local dev without R2): bytes live in Postgres.
//
// Postgres bytes skip Prisma on purpose: its query engine passes bytea values as
// base64 and arrays of numbers, several copies per file. Here an upload is one
// binary parameter and a download is streamed in slices.

/** The subset of the R2 binding used here (types from @cloudflare/workers-types are not loaded app-wide). */
interface R2ObjectBody {
  size: number;
  body: ReadableStream<Uint8Array>;
}
interface R2Bucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

const r2Key = (key: string) => `contract-files/${key}`;

/** The R2 bucket for contract files, or null when this runtime has none. */
function r2(): R2Bucket | null {
  if (!isWorkers) return null;
  const env = getCloudflareContext().env as unknown as { CONTRACT_FILES?: R2Bucket };
  return env.CONTRACT_FILES ?? null;
}

/** Whether new files go to R2 (true) or to Postgres (false). */
export function storesInR2(): boolean {
  return r2() !== null;
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

const SLICE = 1024 * 1024;

const globalForStorage = globalThis as unknown as { fileStoragePool?: Pool };

/** Node: a small shared pool. Workers: a client for this request (Hyperdrive makes connecting cheap). */
async function connect(): Promise<{ db: Client | PoolClient; done: () => Promise<void> }> {
  if (isWorkers) {
    const db = new Client({ connectionString: databaseUrl() });
    // After end(), the Workers socket reports its own closing as an error event;
    // without a listener that would be an uncaught error. Query errors still reach their queries.
    let ending = false;
    db.on("error", (err) => {
      if (!ending) console.error("[file-storage]", err);
    });
    await db.connect();
    return {
      db,
      done: () => {
        ending = true;
        return db.end();
      },
    };
  }
  globalForStorage.fileStoragePool ??= new Pool({ connectionString: databaseUrl(), max: 3 });
  const db = await globalForStorage.fileStoragePool.connect();
  return { db, done: async () => db.release() };
}

async function pgPut(key: string, bytes: Uint8Array): Promise<void> {
  const { db, done } = await connect();
  try {
    // A Buffer parameter is sent as binary, without hex or base64 inflation.
    await db.query('INSERT INTO "ContractFileBlob" ("fileId", "data") VALUES ($1, $2)', [key, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)]);
  } finally {
    await done();
  }
}

/** Postgres: the file's bytes as a stream, or null when nothing is stored under the key. */
async function pgGet(key: string): Promise<{ size: number; body: ReadableStream<Uint8Array> } | null> {
  const { db, done } = await connect();
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await done();
  };
  try {
    const head = await db.query<{ size: number }>('SELECT octet_length("data")::int AS size FROM "ContractFileBlob" WHERE "fileId" = $1', [key]);
    if (!head.rows.length) {
      await release();
      return null;
    }
    const size = head.rows[0].size;
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (offset >= size) {
            controller.close();
            await release();
            return;
          }
          const r = await db.query<{ slice: Buffer | null }>('SELECT substring("data" FROM $2 FOR $3) AS slice FROM "ContractFileBlob" WHERE "fileId" = $1', [
            key,
            offset + 1,
            SLICE,
          ]);
          const slice = r.rows[0]?.slice;
          if (!slice?.length) throw new Error(`File ${key} disappeared while being read`);
          offset += slice.length;
          controller.enqueue(new Uint8Array(slice.buffer, slice.byteOffset, slice.byteLength));
        } catch (err) {
          controller.error(err);
          await release();
        }
      },
      cancel: release,
    });
    return { size, body };
  } catch (err) {
    await release();
    throw err;
  }
}

async function pgDelete(keys: string[]): Promise<void> {
  const { db, done } = await connect();
  try {
    await db.query('DELETE FROM "ContractFileBlob" WHERE "fileId" = ANY($1)', [keys]);
  } finally {
    await done();
  }
}

/** Postgres: all bytes of one file (for moving it to R2), or null. */
async function pgReadAll(key: string): Promise<Uint8Array | null> {
  const { db, done } = await connect();
  try {
    const r = await db.query<{ data: Buffer }>('SELECT "data" FROM "ContractFileBlob" WHERE "fileId" = $1', [key]);
    const data = r.rows[0]?.data;
    return data ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
  } finally {
    await done();
  }
}

export async function putFile(key: string, bytes: Uint8Array): Promise<void> {
  const bucket = r2();
  if (bucket) {
    await bucket.put(r2Key(key), bytes, { httpMetadata: { contentType: "application/pdf" } });
    return;
  }
  await pgPut(key, bytes);
}

/** The file's bytes as a stream, or null when nothing is stored under the key. */
export async function getFile(key: string): Promise<{ size: number; body: ReadableStream<Uint8Array> } | null> {
  const bucket = r2();
  if (!bucket) return pgGet(key);
  const object = await bucket.get(r2Key(key));
  if (object) return { size: object.size, body: object.body };
  // Uploaded before R2: copy it over, then drop the Postgres copy.
  const legacy = await pgReadAll(key);
  if (!legacy) return null;
  await bucket.put(r2Key(key), legacy, { httpMetadata: { contentType: "application/pdf" } });
  await pgDelete([key]);
  return { size: legacy.byteLength, body: streamOf(legacy) };
}

/**
 * Remove stored bytes, wherever they are. Postgres drops its copy with the
 * ContractFile row (cascade), but R2 objects must be deleted explicitly.
 */
export async function deleteFiles(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const bucket = r2();
  if (bucket) await bucket.delete(keys.map(r2Key));
  await pgDelete(keys);
}
