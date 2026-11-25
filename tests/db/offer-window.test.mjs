// Feature 1: offer window + earliest slot (tb.offer_slot, tb.offer_bundle, tb.close_offers).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb } from "../helpers/db.mjs";

let t;
before(async () => { t = await freshDb(); });
after(async () => { await t.close(); });

test("P2: two offers, the earliest slot wins when the window closes (demo clock)", async () => {
  const c = await t.create("9876500001", ["MRI"], "P2");
  assert.equal(c.ok, true);
  let r = await t.ref(c.code);
  assert.notEqual(r.offers_close_at, null, "P2 has an offer window");

  const early = await t.rpc("accept_referral", "lab-d", t.key(), r.id, await t.at(1));
  assert.equal(early.ok, false);
  assert.equal(early.reason, "offer_window", "direct Accept is refused during the window");

  const kB = t.key();
  const oB = await t.rpc("offer_slot", "lab-b", kB, r.id, await t.at(5));
  const oB2 = await t.rpc("offer_slot", "lab-b", kB, r.id, await t.at(5));
  assert.ok(oB.ok && oB2.replayed, "retry with the same key is replayed, not repeated");
  assert.ok((await t.rpc("offer_slot", "lab-b", t.key(), r.id, await t.at(4))).changed, "a lab can change its offer");
  assert.ok((await t.rpc("offer_slot", "lab-c", t.key(), r.id, await t.at(2))).ok);
  assert.equal(await t.count(`select count(*) from tb.referral_offers where referral_id = $1`, [r.id]), 2, "one offer row per lab");

  const smsBefore = await t.msgs("P-RAMESH");
  assert.equal((await t.ref(c.code)).status, "open", "still open while Lab D has not answered");
  await t.rpc("advance_clock", "doc-a", 1);
  r = await t.ref(c.code);
  assert.equal(r.status, "accepted");
  assert.equal(r.accepted_hospital_id, "C", "Lab C offered the earliest slot");
  assert.match(r.selection.reason, /^earliest slot/);
  assert.equal(await t.msgs("P-RAMESH"), smsBefore + 1, "exactly one booking SMS");

  const rb = await t.row(`select response from tb.referral_recipients where referral_id = $1 and hospital_id = 'B'`, [r.id]);
  assert.equal(rb.response, "not_selected");
  const late = await t.rpc("offer_slot", "lab-d", t.key(), r.id, await t.at(1));
  assert.equal(late.ok, false);
  assert.match(late.message, /Already accepted by Navjeevan/);

  await t.rpc("advance_clock", "doc-a", 1);
  assert.equal(await t.msgs("P-RAMESH"), smsBefore + 1, "timers running again send no second SMS");
  assert.ok((await t.audits("offer_selected", r.id)) === 1);
});

test("all labs answered → window closes early; same slot → nearer lab wins", async () => {
  const c = await t.create("9876500002", ["MRI"], "P3");
  const r0 = await t.ref(c.code);
  const slot = await t.at(3);
  await t.rpc("offer_slot", "lab-d", t.key(), r0.id, slot);
  await t.rpc("decline_referral", "lab-c", t.key(), r0.id, "No capacity");
  assert.equal((await t.ref(c.code)).status, "open");
  await t.rpc("offer_slot", "lab-b", t.key(), r0.id, slot);
  const r = await t.ref(c.code);
  assert.equal(r.status, "accepted");
  assert.equal(r.accepted_hospital_id, "B");
  assert.match(r.selection.reason, /nearer/);
});

test("P1: no window, first Accept wins (race → one winner)", async () => {
  const c = await t.create("9876500003", ["MRI"], "P1");
  const r0 = await t.ref(c.code);
  assert.equal(r0.offers_close_at, null);
  const slot = await t.at(1);
  const res = await Promise.all([
    t.rpc("accept_referral", "lab-b", t.key(), r0.id, slot),
    t.rpc("accept_referral", "lab-c", t.key(), r0.id, slot),
  ]);
  assert.equal(res.filter((x) => x.ok).length, 1);
});

test("bundle: all tests at one lab beats an earlier slot for one test; one combined SMS", async () => {
  const c = await t.create("9876500004", ["MRI", "CT"], "P2");
  assert.equal(c.ok, true);
  const mri = (await t.row(`select id from tb.referrals where bundle_id = $1 and test_type_id = 'MRI'`, [c.bundle_id])).id;
  assert.ok((await t.rpc("offer_slot", "lab-c", t.key(), mri, await t.at(1))).ok);
  const ob = await t.rpc("offer_bundle", "lab-d", t.key(), c.bundle_id, await t.at(3));
  assert.ok(ob.ok);
  assert.equal(ob.offered.length, 2);
  const before = await t.msgs("P-KAVITA");
  await t.rpc("advance_clock", "doc-a", 1);
  const [ct, m] = await Promise.all([t.ref(c.codes[0]), t.ref(c.codes[1])]); // codes are sorted: CT, MRI
  assert.equal(m.accepted_hospital_id, "D");
  assert.equal(ct.accepted_hospital_id, "D");
  assert.match(m.selection.reason, /one trip/);
  assert.equal(await t.msgs("P-KAVITA"), before + 1);
});

test("no offers in the window → stays open, then first Accept wins", async () => {
  const c = await t.create("9876500005", ["MRI"], "P2");
  await t.rpc("advance_clock", "doc-a", 1);
  const r = await t.ref(c.code);
  assert.equal(r.status, "open");
  assert.equal(r.selection.offers, 0);
  assert.equal((await t.rpc("accept_referral", "lab-b", t.key(), r.id, await t.at(2))).ok, true);
});
