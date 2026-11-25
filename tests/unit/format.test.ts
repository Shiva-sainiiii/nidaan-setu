// Unit tests for shared display helpers and bilingual dictionaries (lib/format.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPhone, relTime, fmtD, fmtDT, STATUS, CONSENT, PRIORITY } from "../../lib/format.ts";

test("maskPhone hides the middle digits", () => {
  assert.equal(maskPhone("9876543210"), "98xxxx3210");
  assert.equal(maskPhone(null), "—");
});

test("relTime: minutes, hours, days, past and future", () => {
  const now = Date.parse("2026-11-25T10:00:00Z");
  assert.equal(relTime(new Date(now + 5 * 60_000), now), "in 5m");
  assert.equal(relTime(new Date(now - 3 * 3_600_000), now), "3h ago");
  assert.equal(relTime(new Date(now + 3 * 86_400_000), now), "in 3d");
});

test("dates are shown in IST", () => {
  // 20:00 UTC = 01:30 IST next day
  assert.match(fmtD("2026-11-25T20:00:00Z"), /26/);
  assert.match(fmtDT("2026-11-25T20:00:00Z"), /1:30/);
  assert.equal(fmtD(null), "—");
});

test("every status and consent label exists in English and Hindi", () => {
  for (const dict of [STATUS, CONSENT]) {
    for (const [k, v] of Object.entries(dict)) {
      assert.ok(v.en?.trim(), `${k}: English label`);
      assert.match(v.hi, /[ऀ-ॿ]/, `${k}: Hindi label in Devanagari`);
    }
  }
  for (const s of (["open", "accepted", "patient_confirmed", "arrived", "test_done", "report_sent", "closed", "expired", "cancelled", "no_show"] as const)) {
    assert.ok(STATUS[s], `status ${s} has a label`);
  }
  for (const s of ["verbal", "pending_sms", "granted_sms", "refused", "expired"]) assert.ok(CONSENT[s], `consent ${s}`);
  for (const p of ["P1", "P2", "P3"]) assert.ok(PRIORITY[p], `priority ${p}`);
});
