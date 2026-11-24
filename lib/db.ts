import "server-only";
import { Pool, types } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { DEMO_SCHEMA, DEMO_SEED } from "./demo-sql";

// bigint ids and numeric distances as JS numbers (values here are small).
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

const url = process.env.DATABASE_URL;

type Engine = { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>; demo: boolean };
const g = globalThis as unknown as { __tbEngine?: Promise<Engine>; __tbPool?: Pool };

async function startDemo(reason: string): Promise<Engine> {
  console.warn(`[db] DEMO MODE (in-memory database): ${reason}`);
  const db = new PGlite({
    parsers: { 20: (v: string) => parseInt(v, 10), 1700: (v: string) => parseFloat(v) },
  });
  await db.exec(DEMO_SCHEMA);
  await db.exec(DEMO_SEED);
  return { demo: true, query: (sql, params) => db.query(sql, params as unknown[]) };
}

async function startEngine(): Promise<Engine> {
  if (!url || process.env.DEMO_MODE === "1") return startDemo(!url ? "DATABASE_URL not set" : "DEMO_MODE=1");
  const pool =
    g.__tbPool ??
    new Pool({
      connectionString: url,
      ssl: !/localhost|127\.0\.0\.1/.test(url) ? { rejectUnauthorized: false } : false,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  g.__tbPool = pool;
  try {
    await pool.query("select 1 from tb.demo_users limit 1");
    return { demo: false, query: (sql, params) => pool.query(sql, params) };
  } catch (e) {
    return startDemo(`real database unusable (${e instanceof Error ? e.message : e})`);
  }
}

function engine(): Promise<Engine> {
  return (g.__tbEngine ??= startEngine());
}

export async function isDemoMode(): Promise<boolean> {
  return (await engine()).demo;
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await (await engine()).query(sql, params);
  return res.rows as T[];
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
