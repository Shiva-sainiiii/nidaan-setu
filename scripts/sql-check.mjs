// Database-level checks for the offer window (and later features), on a throwaway in-memory PGlite.
// Does NOT touch ./.data or a running app. Usage: npm run check:sql
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec(fs.readFileSync("db/schema.sql", "utf8"));
await db.exec(fs.readFileSync("db/seed.sql", "utf8"));
await db.query("select tb.reset_demo()");

const errors = [];
let n = 0;
const ok = (cond, msg) => { n++; if (!cond) errors.push(msg); console.log(`${cond ? "  ok " : "FAIL"} ${msg}`); };
let k = 0;
const key = () => `sqlcheck-${++k}-${Math.random().toString(36).slice(2)}`;
const rpc = async (fn, ...args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(",");
  return (await db.query(`select tb.${fn}(${ph}) as r`, args)).rows[0].r;
};
const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const at = async (days, hh = "10:00") =>
  (await row(`select (((tb.app_now() at time zone 'Asia/Kolkata')::date + $1::int) + $2::time) at time zone 'Asia/Kolkata' as t`, [days, hh])).t.toISOString();
const ref = (code) => row(`select r.*, h.short_name as lab from tb.referrals r left join tb.hospitals h on h.id = r.accepted_hospital_id where code = $1`, [code]);
const create = (phone, tests, priority, extra = {}) =>
  rpc("create_bundle", "doc-a", key(), JSON.stringify({ phone, tests, priority, temp_med: false, note: "", max_km: 25, consent: true, ...extra }));
const msgs = async (patient) => Number((await row(`select count(*) from tb.messages where patient_id = $1 and direction = 'out'`, [patient])).count);

console.log("Feature 1: offer window + earliest slot");
{ // 1. P2: two offers, earliest wins after the window (demo clock)
  const c = await create("9876500001", ["MRI"], "P2");
  ok(c.ok, `P2 referral created (${c.code})`);
  let r = await ref(c.code);
  ok(r.offers_close_at !== null, "P2 has an offer window");
  const early = await rpc("accept_referral", "lab-d", key(), r.id, await at(1));
  ok(!early.ok && early.reason === "offer_window", "direct Accept during the window is refused (audited)");
  const kB = key();
  const oB = await rpc("offer_slot", "lab-b", kB, r.id, await at(5));
  const oB2 = await rpc("offer_slot", "lab-b", kB, r.id, await at(5));
  ok(oB.ok && oB2.replayed, "Lab B offers +5d; retry with same key is replayed, not repeated");
  ok((await rpc("offer_slot", "lab-b", key(), r.id, await at(4))).changed, "Lab B changes its offer to +4d (still one offer)");
  ok((await rpc("offer_slot", "lab-c", key(), r.id, await at(2))).ok, "Lab C offers +2d");
  ok(Number((await row(`select count(*) from tb.referral_offers where referral_id = $1`, [r.id])).count) === 2, "one offer row per lab");
  const before = await msgs("P-RAMESH");
  r = await ref(c.code);
  ok(r.status === "open", "still open while Lab D has not answered");
  await rpc("advance_clock", "doc-a", 1);
  r = await ref(c.code);
  ok(r.status === "accepted" && r.accepted_hospital_id === "C", `window over → Lab C (earliest) won: ${r.selection?.reason}`);
  ok(/^earliest slot/.test(r.selection?.reason ?? ""), "reason explains the earliest slot");
  ok((await msgs("P-RAMESH")) === before + 1, "patient got exactly one booking SMS");
  const rb = await row(`select response from tb.referral_recipients where referral_id = $1 and hospital_id = 'B'`, [r.id]);
  ok(rb.response === "not_selected", "Lab B marked not_selected");
  const late = await rpc("offer_slot", "lab-d", key(), r.id, await at(1));
  ok(!late.ok && /Already accepted by Navjeevan/.test(late.message), `late lab sees "${late.message}"`);
  await rpc("advance_clock", "doc-a", 1);
  ok((await msgs("P-RAMESH")) === before + 1, "timers again: no second SMS");
}
{ // 2. Everyone responded → closes at once; same slot → nearer lab wins
  const c = await create("9876500002", ["MRI"], "P3");
  const r0 = await ref(c.code);
  const slot = await at(3);
  await rpc("offer_slot", "lab-d", key(), r0.id, slot);
  await rpc("decline_referral", "lab-c", key(), r0.id, "No capacity");
  ok((await ref(c.code)).status === "open", "P3: still open after 1 offer + 1 decline");
  await rpc("offer_slot", "lab-b", key(), r0.id, slot);
  const r = await ref(c.code);
  ok(r.status === "accepted" && r.accepted_hospital_id === "B", `all labs answered → closed early, Lab B won: ${r.selection?.reason}`);
  ok(/nearer/.test(r.selection?.reason ?? ""), "tie on slot → nearer lab");
}
{ // 3. P1: no window, first Accept wins as before
  const c = await create("9876500003", ["MRI"], "P1");
  const r0 = await ref(c.code);
  ok(r0.offers_close_at === null, "P1 has no offer window");
  const [a, b] = await Promise.all([rpc("accept_referral", "lab-b", key(), r0.id, await at(1)), rpc("accept_referral", "lab-c", key(), r0.id, await at(1))]);
  ok([a, b].filter((x) => x.ok).length === 1, "P1 race: exactly one winner");
}
{ // 4. Bundle: whole bundle at one lab beats an earlier slot for one test
  const c = await create("9876500004", ["MRI", "CT"], "P2");
  ok(c.ok, `bundle ${c.bundle_code} created`);
  const mri = (await row(`select id from tb.referrals where bundle_id = $1 and test_type_id = 'MRI'`, [c.bundle_id])).id;
  ok((await rpc("offer_slot", "lab-c", key(), mri, await at(1))).ok, "Lab C offers MRI only, tomorrow");
  const ob = await rpc("offer_bundle", "lab-d", key(), c.bundle_id, await at(3)); // D: both, +3d
  ok(ob.ok && ob.offered.length === 2, "Lab D offers both tests at one slot");
  const before = await msgs("P-KAVITA");
  await rpc("advance_clock", "doc-a", 1);
  const [t, m] = await Promise.all([ref(c.codes[0]), ref(c.codes[1])]); // codes sorted: CT, MRI
  ok(m.accepted_hospital_id === "D" && t.accepted_hospital_id === "D", `both tests at Lab D: ${m.selection?.reason}`);
  ok(/one trip/.test(m.selection?.reason ?? ""), "reason: one trip beats earlier single slot");
  ok((await msgs("P-KAVITA")) === before + 1, "one combined SMS for the bundle");
}
{ // 5. No offers in the window → first lab to Accept afterwards wins
  const c = await create("9876500005", ["MRI"], "P2");
  await rpc("advance_clock", "doc-a", 1);
  const r = await ref(c.code);
  ok(r.status === "open" && r.selection?.offers === 0, "no offers: still open, window closed");
  ok((await rpc("accept_referral", "lab-b", key(), r.id, await at(2))).ok, "then Accept works (first come)");
}
console.log("Feature 2: consent by SMS");
const reply = (patient, body, k = key()) => rpc("patient_reply", patient, k, body);
const recips = async (id) => Number((await row(`select count(*) from tb.referral_recipients where referral_id = $1`, [id])).count);
{ // a. SMS consent → YES
  const before = await msgs("P-ANIL");
  const c = await create("9876500010", ["MRI"], "P2", { consent: false, consent_mode: "sms" });
  ok(c.ok && c.labs_notified === 0, "SMS mode: created without the checkbox, 0 labs notified");
  let r = await ref(c.code);
  ok(r.consent_status === "pending_sms" && !r.consent_recorded && (await recips(r.id)) === 0, "pending_sms, no recipients");
  ok((await msgs("P-ANIL")) === before + 1, "consent SMS sent (YES / NO)");
  const lab = await rpc("offer_slot", "lab-b", key(), r.id, await at(2));
  ok(!lab.ok, "a lab cannot offer/see it before consent");
  const unclear = await reply("P-ANIL", "kal batata hoon");
  ok(unclear.consent === "unclear" && (await ref(c.code)).consent_status === "pending_sms", "unclear reply → polite hint, nothing changes");
  const kY = key();
  const yes = await reply("P-ANIL", "  Yes. ", kY);
  const yes2 = await reply("P-ANIL", "  Yes. ", kY);
  r = await ref(c.code);
  ok(yes.consent === "granted" && yes2.replayed, "\"Yes.\" → granted (retry replayed)");
  ok(r.consent_status === "granted_sms" && r.consent_recorded && (await recips(r.id)) === 3 && r.offers_close_at, "labs notified + offer window started");
}
{ // b. SMS consent → NO (Hindi)
  const c = await create("9876500008", ["CT"], "P2", { consent_mode: "sms" });
  const no = await reply("P-GEETA", "नहीं");
  const r = await ref(c.code);
  ok(no.consent === "refused" && r.status === "cancelled" && r.consent_status === "refused", "\"नहीं\" → cancelled, refused");
  const hq = await row(`select status from tb.home_queue where id = $1`, [r.original_queue_id]);
  ok(hq.status === "booked", "original slot untouched");
  ok(/पुरानी तारीख/.test((await row(`select body_hi from tb.messages where patient_id = 'P-GEETA' order by id desc limit 1`)).body_hi), "keep-your-date SMS (Hindi)");
}
{ // c. No answer → expires after the consent timeout
  const c = await create("9876500009", ["CT"], "P3", { consent_mode: "sms", wait_days: 9 });
  ok(c.ok, "Ram Prakash (no slot) referral waiting for consent");
  await rpc("advance_clock", "doc-a", 24);
  const r = await ref(c.code);
  ok(r.status === "expired" && r.consent_status === "expired", "24h without a reply → expired (consent)");
}
{ // d. Bundle: one consent SMS, one YES unlocks both tests
  const before = await msgs("P-HARISH");
  const c = await create("9876500007", ["MRI", "CT"], "P2", { consent_mode: "sms", wait_days: 14 });
  ok(c.ok && (await msgs("P-HARISH")) === before + 1, "bundle in SMS mode: one consent SMS");
  await reply("P-HARISH", "haan");
  const [t, m] = await Promise.all([ref(c.codes[0]), ref(c.codes[1])]);
  ok(t.consent_status === "granted_sms" && m.consent_status === "granted_sms", "\"haan\" granted both tests");
}
{ // e. "1" still confirms bookings; verbal flow unchanged
  const r = await row(`select id from tb.referrals where status = 'accepted' and patient_id = 'P-RAMESH'`);
  ok(r && (await reply("P-RAMESH", "1")).confirmed === 1, "reply 1 still confirms a booking");
}
const ca = await row(`select count(*) filter (where action = 'consent_requested') q, count(*) filter (where action = 'consent_granted') g,
  count(*) filter (where action = 'consent_refused') rf, count(*) filter (where action = 'consent_expired') ex from tb.audit_log`);
ok(+ca.q >= 4 && +ca.g >= 3 && +ca.rf === 1 && +ca.ex === 1, `audit: requested ${ca.q}, granted ${ca.g}, refused ${ca.rf}, expired ${ca.ex}`);

const audit = await row(`select count(*) filter (where action = 'offer_selected') s, count(*) filter (where action = 'accept_rejected') rj from tb.audit_log`);
ok(Number(audit.s) >= 3 && Number(audit.rj) >= 1, `audit has offer_selected (${audit.s}) and rejected attempts (${audit.rj})`);

console.log(errors.length ? `SQL CHECK FAILED (${errors.length}/${n}):\n - ${errors.join("\n - ")}` : `SQL CHECK PASS (${n} checks)`);
await db.close();
process.exit(errors.length ? 1 : 0);
