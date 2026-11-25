// Unit tests for DATABASE_URL validation (lib/dburl.ts, run directly by Node's TypeScript support).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDatabaseUrl, explainDbError } from "../../lib/dburl.ts";

test("empty value → null (use the built-in local database)", () => {
  assert.equal(normalizeDatabaseUrl(""), null);
  assert.equal(normalizeDatabaseUrl(undefined), null);
  assert.equal(normalizeDatabaseUrl("  "), null);
});

test("valid URL passes through", () => {
  const r = normalizeDatabaseUrl("postgres://postgres:postgres@localhost:54329/nidaansetu");
  assert.equal(r.ok, true);
  assert.equal(r.host, "localhost:54329");
  assert.equal(r.user, "postgres");
});

test("pasted with 'DATABASE_URL=' and quotes is repaired", () => {
  const r = normalizeDatabaseUrl(`DATABASE_URL="postgres://u:p@h:5432/db"`);
  assert.equal(r.ok, true);
});

test("https:// project URL is rejected with a helpful message", () => {
  const r = normalizeDatabaseUrl("https://abc.supabase.co");
  assert.equal(r.ok, false);
  assert.match(r.error, /Postgres connection string/);
});

test("[YOUR-PASSWORD] placeholder is rejected", () => {
  const r = normalizeDatabaseUrl("postgresql://postgres:[YOUR-PASSWORD]@h:6543/postgres");
  assert.equal(r.ok, false);
});

test("special characters in the password are encoded (@ # /)", () => {
  const r = normalizeDatabaseUrl("postgresql://user:p@ss#w/rd@db.example.com:6543/postgres");
  assert.equal(r.ok, true);
  assert.equal(r.host, "db.example.com:6543");
  assert.ok(r.url.includes(encodeURIComponent("p@ss#w/rd")), r.url);
});

test("explainDbError always returns a non-empty string", () => {
  assert.equal(typeof explainDbError(new Error("boom")), "string");
  assert.ok(explainDbError({ code: "ECONNREFUSED" }).length > 0);
});
