// Core referral rules: idempotency, atomic accept race, state machine, slot release, audit trail.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/db.mjs";

let t;
before(async () => { t = await freshDb(); });
after(async () => { await t.close(); });

test("create_referral: double submit with the same key creates exactly one referral", async () => {
  const k = t.key();
  const form = JSON.stringify({ phone: "9876500001", tests: ["MRI"], priority: "P1", temp_med: true, note: "", max_km: 25, consent: true });
  const a = await t.rpc("create_bundle", "doc-a", k, form);
  const b = await t.rpc("create_bundle", "doc-a", k, form);
  assert.equal(a.ok, true);
  assert.equal(b.code, a.code, "retry returns the same referral");
  assert.equal(await t.count(`select count(*) from tb.referrals where patient_id = 'P-RAMESH'`), 1);
});

test("create_referral: verbal mode without the consent checkbox is refused", async () => {
  const r = await t.create("9876500002", ["MRI"], "P1", { consent: false });
  assert.equal(r.ok, false);
});

test("create_referral: a second active referral for the same patient + test is refused", async () => {
  const r = await t.create("9876500001", ["MRI"], "P1");
  assert.equal(r.ok, false);
});

test("accept race (P1): two labs at the same moment → exactly one winner, loser audited", async () => {
  const r = await t.row(`select * from tb.referrals where patient_id = 'P-RAMESH'`);
  const slot = await t.at(1);
  const [b, c] = await Promise.all([
    t.rpc("accept_referral", "lab-b", t.key(), r.id, slot),
    t.rpc("accept_referral", "lab-c", t.key(), r.id, slot),
  ]);
  assert.equal([b, c].filter((x) => x.ok).length, 1, "one winner");
  const loser = b.ok ? c : b;
  assert.match(loser.message, /Already accepted by/);
  assert.equal(await t.audits("accepted", r.id), 1);
  assert.equal(await t.audits("accept_rejected", r.id), 1, "the failed attempt is in the audit log");
  const held = await t.row(`select status from tb.home_queue where id = $1`, [r.original_queue_id]);
  assert.equal(held.status, "held_backup", "original slot kept as backup until the test is done");
});

test("accept is idempotent: replaying the winner's key sends no second SMS", async () => {
  const r = await t.row(`select * from tb.referrals where patient_id = 'P-RAMESH'`);
  const before = await t.msgs("P-RAMESH");
  const k = t.key();
  const first = await t.rpc("accept_referral", "lab-d", k, r.id, await t.at(1));
  const again = await t.rpc("accept_referral", "lab-d", k, r.id, await t.at(1));
  assert.equal(first.ok, false);
  assert.deepEqual({ ...again, replayed: undefined }, { ...first, replayed: undefined });
  assert.equal(await t.msgs("P-RAMESH"), before);
});

test("state machine: out-of-order steps are rejected and audited", async () => {
  const r = await t.row(`select * from tb.referrals where patient_id = 'P-RAMESH'`);
  const lab = `lab-${r.accepted_hospital_id.toLowerCase()}`;
  const bad = await t.rpc("transition_referral", lab, t.key(), r.id, "test_done", "{}");
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Cannot mark as test done/);
  assert.ok((await t.audits("transition_rejected", r.id)) >= 1);
});

test("state machine: another lab cannot move a referral it did not accept", async () => {
  const r = await t.row(`select * from tb.referrals where patient_id = 'P-RAMESH'`);
  const other = r.accepted_hospital_id === "B" ? "lab-c" : "lab-b";
  const res = await t.rpc("transition_referral", other, t.key(), r.id, "arrived", "{}");
  assert.equal(res.ok, false);
});

test("lifecycle: confirm → arrived → test done releases the original slot to the next patient", async () => {
  const r = await t.row(`select * from tb.referrals where patient_id = 'P-RAMESH'`);
  const lab = `lab-${r.accepted_hospital_id.toLowerCase()}`;
  assert.equal((await t.reply("P-RAMESH", "1")).confirmed, 1);
  assert.equal((await t.rpc("transition_referral", lab, t.key(), r.id, "arrived", "{}")).ok, true);
  assert.equal((await t.rpc("transition_referral", lab, t.key(), r.id, "test_done", "{}")).ok, true);
  const q = await t.row(`select * from tb.home_queue where id = $1`, [r.original_queue_id]);
  assert.equal(q.status, "released");
  assert.ok(q.released_to_patient_id, "slot given to the next waiting patient");
  const next = await t.row(`select status, slot_at from tb.home_queue where hospital_id = 'A' and test_type_id = 'MRI' and patient_id = $1`, [q.released_to_patient_id]);
  assert.equal(next.status, "booked");
  assert.equal(+next.slot_at, +q.slot_at);
  assert.equal(await t.audits("original_slot_released", r.id), 1);
});

test("report: one report per referral; a second upload is rejected", async () => {
  const r = await t.row(`select * from tb.referrals where patient_id = 'P-RAMESH'`);
  const lab = `lab-${r.accepted_hospital_id.toLowerCase()}`;
  const pdf = Buffer.from("%PDF-1.4 test");
  const a = await t.rpc("attach_report", lab, t.key(), r.id, "r.pdf", "application/pdf", pdf, "Dr. Test", "REG-1");
  assert.equal(a.ok, true);
  assert.equal((await t.ref(r.code)).status, "report_sent");
  const b = await t.rpc("attach_report", lab, t.key(), r.id, "r.pdf", "application/pdf", pdf, "Dr. Test", "REG-1");
  assert.equal(b.ok, false);
  assert.equal(await t.count(`select count(*) from tb.reports where referral_id = $1`, [r.id]), 1);
});

test("no-show: referral goes back to open and the original slot is still held", async () => {
  const c = await t.create("9876500002", ["MRI"], "P1");
  const r = await t.ref(c.code);
  assert.equal((await t.rpc("accept_referral", "lab-b", t.key(), r.id, await t.at(1))).ok, true);
  assert.equal((await t.rpc("transition_referral", "lab-b", t.key(), r.id, "no_show", "{}")).ok, true);
  const after = await t.ref(c.code);
  assert.equal(after.status, "open");
  assert.equal(after.accepted_hospital_id, null);
  const q = await t.row(`select status from tb.home_queue where id = $1`, [r.original_queue_id]);
  assert.equal(q.status, "held_backup");
});

test("audit_log is append-only (UPDATE and DELETE raise)", async () => {
  await assert.rejects(t.db.query(`update tb.audit_log set action = 'x'`), /append-only/);
  await assert.rejects(t.db.query(`delete from tb.audit_log`), /append-only/);
});

test("messages are deduplicated by dedupe_key", async () => {
  const before = await t.msgs("P-RAMESH");
  await t.db.query(`select tb.send_msg('P-RAMESH', null, 'test-dedupe', 'हिंदी', 'English')`);
  await t.db.query(`select tb.send_msg('P-RAMESH', null, 'test-dedupe', 'हिंदी', 'English')`);
  assert.equal(await t.msgs("P-RAMESH"), before + 1);
});
