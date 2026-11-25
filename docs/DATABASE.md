# Database

Everything lives in the Postgres schema `tb`, defined in [db/schema.sql](../db/schema.sql). Demo data comes from [db/seed.sql](../db/seed.sql).

## Tables

| Table | Purpose |
|---|---|
| `hospitals` | Hospitals A–F: name, `govt`/`ppp`, lat/lng, bilingual address. |
| `test_types` | MRI, CT, ECHO …, with bilingual preparation and "what to bring" text. |
| `hospital_tests` | Which hospital offers which test: free or paid, price, current wait in days. |
| `demo_users` | Demo logins: doctor, lab desks, district health officer (DHO). |
| `patients` | Synthetic patients: phone, language. |
| `home_queue` | Hospital A's own test queue. A slot is `booked`, then `held_backup` while a referral is active, then `released` to the next `waiting` patient. |
| `referral_bundles` | Several tests for one patient, done in one trip. |
| `referrals` | The core record: status, priority, consent mode/status, offer window, accepted lab and slot, patient token. |
| `referral_recipients` | Labs notified for a referral: distance, score breakdown, response (`offered`, `accepted`, `lost_race`, `declined`, `not_selected`). |
| `referral_offers` | One slot offer per lab per referral during the offer window. |
| `reports` | Uploaded PDF report. **Unique per referral.** |
| `messages` | Simulated SMS, in and out, Hindi + English. **Unique `dedupe_key`.** |
| `audit_log` | Append-only. A trigger blocks UPDATE and DELETE. |
| `idempotency` | Stored result per idempotency key. |
| `demo_clock` | Offset that shifts `tb.app_now()` for demos and tests. |

Important constraints:
- A partial unique index allows only one active referral per patient and test.
- Consent check: `consent_recorded` may be false only while consent is pending, refused or expired.

## Referral state machine

```
open ──► accepted ──► patient_confirmed ──► arrived ──► test_done ──► report_sent ──► closed
 │          │                │
 │          └────────────────┴──► no_show ──► (back to open; the original slot is still held)
 ├──► expired    (no lab in time, or no consent reply in 24 h)
 └──► cancelled  (doctor, or patient replied NO)
```

`tb.transition_referral` holds the allowed "from" states for each step. A wrong step is rejected and recorded as `transition_rejected`. Only the accepting lab can move lab steps, and only the referring hospital's doctor can cancel or close.

## Functions

| Function | What it does |
|---|---|
| `create_referral(actor, idem, json)` / `create_bundle(...)` | Creates the referral or bundle and holds the original slot. Verbal consent: notifies labs in the radius. SMS consent: sends the YES/NO SMS and notifies nobody yet. |
| `add_recipients(ref, round)` | Notifies labs that offer the test within the radius and stores the score breakdown. |
| `score(priority, temp_med, created, km)` | Transparent urgency score: P1 +100 / P2 +50 / P3 +10, temporary medication +30, +2 per waiting day, −1 per km. |
| `accept_referral(actor, idem, ref, slot)` / `accept_bundle(...)` | Atomic accept by compare-and-set. The loser gets "Already accepted by …" and the attempt is audited. Refused while an offer window is open. |
| `offer_slot(...)` / `offer_bundle(...)` | A lab offers or changes a slot during the window (one offer per lab). |
| `close_offers(ref, reason)` | Ranks offers and books the winner. Ranking: whole bundle at one lab, then earliest slot, then shorter distance, then free lab, then first offer. Stores a human-readable reason. |
| `decline_referral(...)` | A lab declines. If every lab has answered, the window closes early. |
| `transition_referral(actor, idem, ref, to)` | arrived / test_done / no_show / cancelled / closed, with the side effects (slot release, reopen, SMS). |
| `release_original_slot(...)` | Gives Hospital A's original slot to the next waiting patient and sends them an SMS. |
| `attach_report(...)` | Stores the PDF (one per referral) and tells the doctor how many days earlier the result came. |
| `patient_reply(patient, idem, body)` | `YES/haan/हाँ` grants consent; `NO/nahi/नहीं` cancels and keeps the original date; `1` confirms the booking. Anything else gets a polite hint and changes nothing. |
| `process_timers()` | Consent expiry, closing offer windows, radius widening, expiry, reminders. |
| `advance_clock(actor, hours)` / `reset_demo()` | Demo controls. |
| `audit(...)`, `send_msg(...)`, `idem_begin/idem_end`, `fail(...)` | The building blocks every function uses. |

Time windows (all on the demo clock):

| | P1 | P2 | P3 |
|---|---|---|---|
| Offer collection window (`offer_collect_window`) | none: first accept wins | 1 h | 4 h |
| Total time before radius widening / expiry (`offer_window`) | 2 h | 6 h | 24 h |

The consent SMS must be answered within 24 h (`consent_timeout`).

## Changing the schema

1. Edit `db/schema.sql` (and `db/seed.sql` / `tb.reset_demo()` if needed).
2. Bump `SCHEMA_VERSION` in `lib/db.ts` **and** the `comment on schema tb` line at the end of `schema.sql`.
3. Add a test in `tests/db/`, then run `npm test`.
