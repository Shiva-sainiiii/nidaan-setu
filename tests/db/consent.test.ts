// Feature 2: consent by SMS (consent_mode/status, tb.patient_reply YES/NO, 24h timeout).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, type Db } from "../helpers/db.ts";

let t: Db;
before(async () => { t = await freshDb(); });
after(async () => { await t.close(); });

const recips = (id: number) => t.count(`select count(*) from tb.referral_recipients where referral_id = $1`, [id]);

test("SMS mode: labs see nothing until YES; unclear replies change nothing; YES unlocks", async () => {
  const before = await t.msgs("P-ANIL");
  const c = await t.create("9876500010", ["MRI"], "P2", { consent: false, consent_mode: "sms" });
  assert.equal(c.ok, true);
  assert.equal(c.labs_notified, 0);
  let r = await t.ref(c.code);
  assert.equal(r.consent_status, "pending_sms");
  assert.equal(r.consent_recorded, false);
  assert.equal(await recips(r.id), 0, "no recipients before consent");
  assert.equal(await t.msgs("P-ANIL"), before + 1, "consent SMS sent");

  assert.equal((await t.rpc("offer_slot", "lab-b", t.key(), r.id, await t.at(2))).ok, false, "lab cannot act before consent");

  const unclear = await t.reply("P-ANIL", "kal batata hoon");
  assert.equal(unclear.consent, "unclear");
  assert.equal((await t.ref(c.code)).consent_status, "pending_sms");

  const k = t.key();
  const yes = await t.reply("P-ANIL", "  Yes. ", k);
  const yes2 = await t.reply("P-ANIL", "  Yes. ", k);
  assert.equal(yes.consent, "granted");
  assert.ok(yes2.replayed, "retry is replayed");
  r = await t.ref(c.code);
  assert.equal(r.consent_status, "granted_sms");
  assert.equal(r.consent_recorded, true);
  assert.equal(await recips(r.id), 3, "labs notified");
  assert.ok(r.offers_close_at, "offer window started");
});

test("NO in Hindi cancels; the original queue slot is untouched; keep-your-date SMS", async () => {
  const c = await t.create("9876500008", ["CT"], "P2", { consent_mode: "sms" });
  const no = await t.reply("P-GEETA", "नहीं");
  const r = await t.ref(c.code);
  assert.equal(no.consent, "refused");
  assert.equal(r.status, "cancelled");
  assert.equal(r.consent_status, "refused");
  assert.equal((await t.row(`select status from tb.home_queue where id = $1`, [r.original_queue_id])).status, "booked");
  const last = await t.row(`select body_hi from tb.messages where patient_id = 'P-GEETA' order by id desc limit 1`);
  assert.match(last.body_hi, /पुरानी तारीख/);
});

test("no reply within the consent timeout → expired", async () => {
  const c = await t.create("9876500009", ["CT"], "P3", { consent_mode: "sms", wait_days: 9 });
  assert.equal(c.ok, true);
  await t.rpc("advance_clock", "doc-a", 24);
  const r = await t.ref(c.code);
  assert.equal(r.status, "expired");
  assert.equal(r.consent_status, "expired");
});

test("bundle: one consent SMS, one 'haan' unlocks every test", async () => {
  const before = await t.msgs("P-HARISH");
  const c = await t.create("9876500007", ["MRI", "CT"], "P2", { consent_mode: "sms", wait_days: 14 });
  assert.equal(c.ok, true);
  assert.equal(await t.msgs("P-HARISH"), before + 1);
  await t.reply("P-HARISH", "haan");
  const [ct, m] = await Promise.all([t.ref(c.codes[0]), t.ref(c.codes[1])]);
  assert.equal(ct.consent_status, "granted_sms");
  assert.equal(m.consent_status, "granted_sms");
});

test("verbal flow unchanged; reply '1' still confirms a booking", async () => {
  const c = await t.create("9876500001", ["MRI"], "P1");
  const r = await t.ref(c.code);
  assert.equal(r.consent_status, "verbal");
  assert.ok((await t.rpc("accept_referral", "lab-b", t.key(), r.id, await t.at(1))).ok);
  assert.equal((await t.reply("P-RAMESH", "1")).confirmed, 1);
});

test("every consent step is in the audit log", async () => {
  assert.ok((await t.audits("consent_requested")) >= 3);
  assert.ok((await t.audits("consent_granted")) >= 2);
  assert.equal(await t.audits("consent_refused"), 1);
  assert.equal(await t.audits("consent_expired"), 1);
});
