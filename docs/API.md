# API reference

## HTTP endpoints

| Method & path | Auth | Description |
|---|---|---|
| `GET /api/health` | none | Database mode and status. Returns `200 {ok:true, mode, counts}`, or `503 {ok:false, error}`. Never shows the password. Used by the Docker and Render health checks. |
| `GET /api/live?view=<view>` | demo cookie | Live data for one screen, polled every 2 s. Also runs `tb.process_timers()` at most every 30 s. |
| `GET /api/status/[token]` | none (secret token) | The patient's public status: minimal data, no other patients. |
| `GET /api/reports/[id]` | referring doctor, accepting lab, or DHO | Downloads the report PDF. Each view is written to the audit log. |
| `POST /api/reports/[id]` | accepting lab | `multipart/form-data`: `file` (PDF, max 4 MB, checked by magic bytes), `reported_by`, `reg_no`, `idem`. Calls `tb.attach_report`. |

`/api/live` views:

| `view` | Role | Extra params | Returns |
|---|---|---|---|
| `doctor` | doctor | | My referrals, KPIs |
| `queue` | doctor | | Hospital A's queue |
| `lab` | lab | | Incoming (sorted by score, with offer window), booked, done, missed |
| `referral` | any logged-in user | `id` | Detail, timeline, offers, consent |
| `dho` | dho | `test=MRI`, `days=1\|7\|30` | KPIs, hospitals with lat/lng and utilisation, flows for the map |
| `phone` | none (demo) | `patient` | Simulated SMS thread |
| `audit` | none (demo) | `q` | Audit log search |

Every response looks like `{ now, clockOffsetH, data }` and has `cache-control: no-store`. A wrong role returns `403`.

## Server actions (`app/actions.ts`)

Every write is a server action. It checks the role and calls one database function. Mutations take an **idempotency key** (`idem`) from the `useIdemKey()` hook. The client rotates the key after a definitive answer and keeps it on a network error, so retries are safe.

| Action | Role | Database function |
|---|---|---|
| `loginAs(form)`, `logout()` | any | sets or clears the `tb_user` cookie |
| `createReferral(form, idem)` | doctor | `create_bundle` (one test = a plain referral) |
| `lookupPatientAction(phone, tests)`, `previewLabsAction(tests, km)` | doctor | read-only preview |
| `acceptReferral(id, slot, idem)`, `acceptBundle(bundleId, slot, idem)` | lab | `accept_referral`, `accept_bundle` |
| `offerSlot(id, slot, idem)`, `offerBundle(bundleId, slot, idem)` | lab | `offer_slot`, `offer_bundle` |
| `declineReferral(id, reason, idem)` | lab | `decline_referral` |
| `transition(id, to, idem)` | lab: arrived / test_done / no_show; doctor: cancelled / closed | `transition_referral` |
| `revealPatient(id)` | accepting lab | read + `log_view` audit |
| `patientReply(patientId, body, idem)` | simulated phone | `patient_reply` |
| `resetDemo()`, `advanceClock(hours)` | demo controls | `reset_demo`, `advance_clock` |

Result shape (`RpcResult`): `{ ok: true, ... }`, or `{ ok: false, reason, message }`. A replayed idempotency key returns the original result with `replayed: true`.
