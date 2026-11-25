// Test helper: a fresh, throwaway in-memory database (PGlite) with the real schema + demo seed.
// Never touches ./.data or a running app. Each test file gets its own database.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/** Result of a tb.* function or a row: JSON from the database, checked by the tests at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function freshDb() {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(ROOT, "db/schema.sql"), "utf8"));
  await db.exec(fs.readFileSync(path.join(ROOT, "db/seed.sql"), "utf8"));
  await db.query("select tb.reset_demo()");

  let k = 0;
  const key = () => `test-${++k}-${Math.random().toString(36).slice(2)}`;
  const rpc = async (fn: string, ...args: unknown[]): Promise<Json> => {
    const ph = args.map((_, i) => `$${i + 1}`).join(",");
    return (await db.query<{ r: Json }>(`select tb.${fn}(${ph}) as r`, args)).rows[0].r;
  };
  const row = async (sql: string, args: unknown[] = []): Promise<Json> => (await db.query<Json>(sql, args)).rows[0];
  const count = async (sql: string, args: unknown[] = []) => Number((await row(sql, args)).count);

  /** IST date `days` from the demo clock's today, at hh:mm, as ISO string. */
  const at = async (days: number, hh = "10:00"): Promise<string> =>
    (await row(
      `select (((tb.app_now() at time zone 'Asia/Kolkata')::date + $1::int) + $2::time) at time zone 'Asia/Kolkata' as t`,
      [days, hh],
    )).t.toISOString();

  /** Referral row by code, plus the accepting lab's short name. */
  const ref = (code: string) =>
    row(
      `select r.*, h.short_name as lab from tb.referrals r
         left join tb.hospitals h on h.id = r.accepted_hospital_id where code = $1`,
      [code],
    );

  /** Doctor A creates a referral (1 test) or bundle (several tests) for a seeded demo patient. */
  const create = (phone: string, tests: string[], priority: "P1" | "P2" | "P3", extra: Json = {}) =>
    rpc("create_bundle", "doc-a", key(), JSON.stringify({
      phone, tests, priority, temp_med: false, note: "", max_km: 25, consent: true, ...extra,
    }));

  const msgs = (patient: string) => count(`select count(*) from tb.messages where patient_id = $1 and direction = 'out'`, [patient]);
  const audits = (action: string, refId: number | null = null) =>
    count(`select count(*) from tb.audit_log where action = $1 and ($2::bigint is null or referral_id = $2)`, [action, refId]);
  const reply = (patient: string, body: string, k = key()) => rpc("patient_reply", patient, k, body);

  return { db, key, rpc, row, count, at, ref, create, msgs, audits, reply, close: () => db.close() };
}

export type Db = Awaited<ReturnType<typeof freshDb>>;
