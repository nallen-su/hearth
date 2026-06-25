/**
 * PostgreSQL connection pool (lazy singleton).
 *
 * The pool is created on first use (not at import) so `next build` doesn't open
 * connections or read env while collecting page data. It's cached on globalThis to
 * survive Next.js dev HMR without exhausting connections.
 */
import { Pool } from "pg";
import { getConfig } from "@/lib/config";

const globalForDb = globalThis as unknown as { hearthPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.hearthPool) {
    globalForDb.hearthPool = new Pool({ connectionString: getConfig().database.url });
  }
  return globalForDb.hearthPool;
}

/** Lightweight connectivity check used by the health endpoint. */
export async function pingDatabase(): Promise<boolean> {
  const result = await getPool().query("SELECT 1 AS ok");
  return result.rows[0]?.ok === 1;
}
