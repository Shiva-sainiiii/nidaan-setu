import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { explainDbError, normalizeDatabaseUrl } from "./dburl";

/**
 * Two storage modes, same SQL:
 *  - DATABASE_URL empty (default): embedded Postgres (PGlite) stored in ./.data/pglite.
 *    No install, no Docker. Created and seeded automatically on first start. NOT for Vercel.
 *  - DATABASE_URL set: a real Postgres server (Supabase, Docker, …) via `pg`.
 *    If schema "tb" does not exist yet it is created + seeded automatically (once, under a lock).
 */
const urlCheck = normalizeDatabaseUrl(process.env.DATABASE_URL);
const ON_VERCEL = Boolean(process.env.VERCEL);
export const DB_MODE: "pglite" | "postgres" = urlCheck ? "postgres" : "pglite";
const DATA_DIR = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
const SQL_DIR = path.join(process.cwd(), "db");
/** Must match the `comment on schema tb` line at the end of db/schema.sql. */
const SCHEMA_VERSION = "nidaansetu-schema-v3";
const VERSION_SQL = `select coalesce(obj_description(to_regnamespace('tb'), 'pg_namespace'), '') as v`;
const sqlFile = (f: string) => fs.readFileSync(path.join(SQL_DIR, f), "utf8");

type Rows = Record<string, unknown>[];
type Runner = (sql: string, params: unknown[]) => Promise<Rows>;

const g = globalThis as unknown as { __tbRunner?: Promise<Runner>; __tbInit?: string[] };
const initLog = (g.__tbInit ??= []);

async function makePg(url: string): Promise<Runner> {
  const { Pool, types } = await import("pg");
  types.setTypeParser(20, (v: string) => parseInt(v, 10)); // bigint ids → number
  types.setTypeParser(1700, (v: string) => parseFloat(v)); // numeric → number
  const pool: Pool = new Pool({
    connectionString: url,
    ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : { rejectUnauthorized: false },
    max: ON_VERCEL ? 2 : 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });
  pool.on("error", (e) => console.error("[db] idle client error", e.message));

  // First use: create schema + demo data if missing. Transaction-scoped advisory lock so that
  // many serverless instances starting at once cannot run it twice (works with the pooler).
  const client = await pool.connect().catch((e) => {
    throw new Error(explainDbError(e));
  });
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(724242)");
    const { rows } = await client.query(VERSION_SQL);
    if (rows[0].v !== SCHEMA_VERSION) {
      // Missing or older schema: (re)create it. Demo data only, so rebuilding is safe.
      console.log(`[db] schema tb ${rows[0].v ? `is "${rows[0].v}"` : "missing"}: creating ${SCHEMA_VERSION} with demo data`);
      await client.query(sqlFile("schema.sql"));
      await client.query(sqlFile("seed.sql"));
      const pub = await client.query("select 1 from pg_publication where pubname = 'supabase_realtime'");
      if (pub.rowCount) await client.query(sqlFile("supabase-realtime.sql"));
      initLog.push(`${SCHEMA_VERSION} created ${new Date().toISOString()}`);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw new Error(explainDbError(e));
  } finally {
    client.release();
  }
  return async (sql, params) => {
    try {
      return (await pool.query(sql, params)).rows;
    } catch (e) {
      if (e instanceof Error && /tb\.|schema "tb"/.test(e.message)) throw e; // real SQL error: keep it
      throw new Error(explainDbError(e));
    }
  };
}

async function makePglite(): Promise<Runner> {
  if (ON_VERCEL) {
    throw new Error(
      "DATABASE_URL is empty on Vercel. The built-in local database cannot work on Vercel (many short-lived " +
        "servers, read-only disk). Set DATABASE_URL to your Supabase Transaction pooler URI in Vercel → Settings → " +
        "Environment Variables (Production), then Redeploy.",
    );
  }
  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db: PGlite = new PGlite(DATA_DIR, {
    parsers: { 20: (v: string) => parseInt(v, 10), 1700: (v: string) => parseFloat(v) },
  });
  await db.waitReady;
  const ver = await db.query<{ v: string }>(VERSION_SQL);
  if (ver.rows[0]?.v !== SCHEMA_VERSION) {
    console.log(`[nidaan-setu] ${ver.rows[0]?.v ? "upgrading" : "creating"} local database in ${DATA_DIR} …`);
    await db.exec(sqlFile("schema.sql"));
    await db.exec(sqlFile("seed.sql"));
    console.log("[nidaan-setu] local database ready (demo data loaded)");
  }
  return async (sql, params) => (await db.query(sql, params)).rows as Rows;
}

function runner(): Promise<Runner> {
  if (!g.__tbRunner) {
    let p: Promise<Runner>;
    if (urlCheck && !urlCheck.ok) p = Promise.reject(new Error(urlCheck.error));
    else if (urlCheck?.ok) p = makePg(urlCheck.url);
    else p = makePglite();
    g.__tbRunner = p.catch((e) => {
      g.__tbRunner = undefined; // retry on the next request (e.g. after a transient network error)
      console.error("[db] not connected:", e instanceof Error ? e.message : e);
      throw e;
    });
  }
  return g.__tbRunner;
}

/** Safe-to-show status for /api/health and the login page (never includes the password). */
export async function dbStatus() {
  const base = {
    mode: DB_MODE,
    onVercel: ON_VERCEL,
    host: urlCheck?.ok ? urlCheck.host : null,
    user: urlCheck?.ok ? urlCheck.user : null,
    urlNotes: urlCheck?.ok ? urlCheck.notes : [],
    init: initLog,
  };
  try {
    const run = await runner();
    const [r] = await run(
      `select (select count(*) from tb.hospitals)::int as hospitals, (select count(*) from tb.referrals)::int as referrals`,
      [],
    );
    return { ok: true as const, ...base, counts: r };
  } catch (e) {
    return { ok: false as const, ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await (await runner())(sql, params)) as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export type RpcResult = {
  ok: boolean;
  reason?: string;
  message?: string;
  replayed?: boolean;
  [k: string]: unknown;
};

/** Calls a tb.* Postgres function that returns jsonb. All state changes go through these. */
export async function rpc(fn: string, args: unknown[]): Promise<RpcResult> {
  if (!/^[a-z_]+$/.test(fn)) throw new Error("bad rpc name");
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  try {
    const row = await one<{ r: RpcResult }>(`select tb.${fn}(${ph}) as r`, args);
    return row?.r ?? { ok: false, message: "No result" };
  } catch (e) {
    console.error(`rpc ${fn} failed`, e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : "Database error" };
  }
}
