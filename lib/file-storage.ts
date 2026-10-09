import { Client, Pool, type PoolClient } from "pg";
import { databaseUrl, isWorkers } from "./prisma";

// Bytes of uploaded files, by key (the ContractFile id); the metadata stays in
// Prisma models. Today the bytes live in Postgres ("ContractFileBlob"). To move
// them to Cloudflare R2, reimplement putFile/getFile/deleteFiles over an R2
// binding and drop the table; callers do not change.
//
// Bytes skip Prisma on purpose: its query engine passes bytea values as base64
// and arrays of numbers, several copies per file. Here an upload is one binary
// parameter and a download is streamed in slices, so a Worker never holds more
// than the file plus one slice.

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

export async function putFile(key: string, bytes: Uint8Array): Promise<void> {
  const { db, done } = await connect();
  try {
    // A Buffer parameter is sent as binary, without hex or base64 inflation.
    await db.query('INSERT INTO "ContractFileBlob" ("fileId", "data") VALUES ($1, $2)', [key, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)]);
  } finally {
    await done();
  }
}

/** The file's bytes as a stream, or null when nothing is stored under the key. */
export async function getFile(key: string): Promise<{ size: number; body: ReadableStream<Uint8Array> } | null> {
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

/** Remove stored bytes. Postgres already drops them with their ContractFile rows (cascade); R2 would not. */
export async function deleteFiles(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const { db, done } = await connect();
  try {
    await db.query('DELETE FROM "ContractFileBlob" WHERE "fileId" = ANY($1)', [keys]);
  } finally {
    await done();
  }
}
