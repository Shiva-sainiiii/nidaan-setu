// Unit tests for DATABASE_URL validation (lib/dburl.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDatabaseUrl, explainDbError } from "../../lib/dburl.ts";

/** Parses and asserts the URL was accepted. */
function accepted(raw: string) {
  const r = normalizeDatabaseUrl(raw);
  assert.ok(r && r.ok, `expected ${raw} to be accepted, got ${JSON.stringify(r)}`);
  return r;
}

/** Parses and asserts the URL was rejected; returns the error message. */
function rejected(raw: string) {
  const r = normalizeDatabaseUrl(raw);
  assert.ok(r && !r.ok, `expected ${raw} to be rejected`);
  return r.error;
}

test("empty value → null (use the built-in local database)", () => {
  assert.equal(normalizeDatabaseUrl(""), null);
  assert.equal(normalizeDatabaseUrl(undefined), null);
  assert.equal(normalizeDatabaseUrl("  "), null);
});

test("valid URL passes through", () => {
  const r = accepted("postgres://postgres:postgres@localhost:54329/nidaansetu");
  assert.equal(r.host, "localhost:54329");
  assert.equal(r.user, "postgres");
});

test("pasted with 'DATABASE_URL=' and quotes is repaired", () => {
  accepted(`DATABASE_URL="postgres://u:p@h:5432/db"`);
});

test("https:// project URL is rejected with a helpful message", () => {
  assert.match(rejected("https://abc.supabase.co"), /Postgres connection string/);
});

test("[YOUR-PASSWORD] placeholder is rejected", () => {
  assert.match(rejected("postgresql://postgres:[YOUR-PASSWORD]@h:6543/postgres"), /placeholder/);
});

test("special characters in the password are encoded (@ # /)", () => {
  const r = accepted("postgresql://user:p@ss#w/rd@db.example.com:6543/postgres");
  assert.equal(r.host, "db.example.com:6543");
  assert.ok(r.url.includes(encodeURIComponent("p@ss#w/rd")), r.url);
});

test("explainDbError always returns a non-empty string", () => {
  assert.equal(typeof explainDbError(new Error("boom")), "string");
  assert.ok(explainDbError({ code: "ECONNREFUSED" }).length > 0);
});
