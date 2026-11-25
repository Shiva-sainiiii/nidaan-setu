# Nidaan Setu

[![CI](https://github.com/Shiva-sainiiii/nidaan-setu/actions/workflows/ci.yml/badge.svg)](https://github.com/Shiva-sainiiii/nidaan-setu/actions/workflows/ci.yml)

> **Your doctor stays the same. Only the test moves, to wherever it can be done fastest.**
> आपका डॉक्टर वही रहेगा। सिर्फ़ जाँच वहाँ होगी जहाँ सबसे जल्दी हो सके।

A government-hospital doctor whose MRI/CT/ECHO queue is weeks long sends a **test referral** to nearby partner labs.
One lab accepts a slot (exactly one, guaranteed by the database), the patient gets an SMS in Hindi + English,
the report comes back to the original doctor, and the patient's original queue slot is released to the next patient.

NexHack 2.0 · Open Innovation · **all hospitals, patients and phone numbers are fictional (synthetic data).**
## Documentation

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | components, request flow, design decisions |
| [docs/DATABASE.md](docs/DATABASE.md) | tables, referral state machine, all `tb.*` functions |
| [docs/API.md](docs/API.md) | HTTP endpoints and server actions |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | how each role uses the app |
| [docs/TESTING.md](docs/TESTING.md) | unit, database and end-to-end tests |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, Render, Vercel + Supabase, offline LAN |
| [SECURITY.md](SECURITY.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) | security model, code rules, changes |

Pitch plan and judge Q&A: [PLAN.md](PLAN.md).

---

## Run it locally (2 minutes, nothing else to install)

Needs only **Node.js 20+**. No Postgres, no Docker.

```bash
npm install
cp .env.example .env.local      # DATABASE_URL stays empty → built-in local database
npm run dev                     # http://localhost:3000
```

On first start the app creates its database in `./.data/pglite` (PGlite: real Postgres running inside Node)
and loads the demo data. Data survives restarts.

- During a demo: **Demo controls → Reset demo data** (header).
- Wipe completely: stop the app, `npm run db:reset`, start again.
- Optional: use a real Postgres instead (Supabase or Docker): set `DATABASE_URL` in `.env.local`, then `npm run db:reset` applies the schema there.

### Demo logins (no passwords: demo only)
| Login card | Role | Lands on |
|---|---|---|
| Dr. A. Mehta | Referring doctor, Jan Kalyan Civil Hospital (A) | `/doctor` |
| Lab desk, Sarvodaya SDH | Lab B, 10 km, free | `/lab` |
| Lab desk, Navjeevan CHC | Lab C, 12 km, free | `/lab` |
| Lab desk, Arogya PPP | Lab D, 15 km, paid PPP | `/lab` |
| Lab desk, Shanti Nagar CHC / Ratanpur PHC | Labs E, F (no MRI) | `/lab` |
| District Health Officer | District dashboard | `/dho` |
| *(no login)* | Patient phone, audit log | `/phone`, `/audit` |

The login is a cookie per browser. To be the doctor and a lab on one laptop, use a normal window plus a private/incognito window (or two browser profiles).

Demo patient: **Ramesh Kumar, 9876500001**, already has an MRI slot in Hospital A's queue 14 days out.
The next patient waiting with no date is **Pooja Rani**: she receives the released slot.

---

## The demo flow (5 min, see PLAN.md §7 for the word-for-word script)

| # | Device | Action | What judges see |
|---|---|---|---|
| 1 | Laptop 1: doctor | New referral → **Use demo patient** → priority **P1 Urgent** → tick consent → **Send to 3 labs** | Original slot 14 days away, 3 labs within 25 km (2 free) |
| 2 | Laptops 2 + 3: Lab B, Lab C | Request pops up on both (with a beep). Both press **Accept** together | One gets “Accepted”, the other “**Already accepted by …**” |
| 3 | Phone: `/phone` | Hindi + English SMS arrives; tap **1** | Status link opens `/s/…` in Hindi; shows “confirmed” |
| 4 | Winning lab, tab **Booked / today** | **Arrived** → **Test done** → **Use sample report** → **Upload & send** | Upload is only possible in the right order |
| 5 | Laptop 1 | Referral page, then **Hospital queue** | “**Report ready: 14 days earlier**”; original slot moved to Pooja Rani |
| 6 | Any | **Audit log** | Every action incl. the losing accept and every view of patient data |
| 7 | Laptop 1 → Labs B, C | New referral for **9876500002** (Sunita, **P2**) → Lab B **Offer slot** +3 days, Lab C **Offer slot** +2 days → Demo controls **+1h** | Doctor page: “**Navjeevan CHC chosen from 2 offers · why: earliest slot: 27 Nov vs 28 Nov**”; Lab B sees “Already accepted by Navjeevan · earliest slot …” |

**Offer window (P2 / P3):** instead of “first click wins”, labs send their **earliest slot** for a short window
(P2: 1 hour, P3: 4 hours; **P1 has none**, so urgent cases never wait). The window closes early when every notified lab has
offered or declined. Winner rule, shown on the doctor's page: **whole bundle at one lab (one trip) → earliest slot → nearer →
free lab → offered first**. No offers in the window → the first lab to press Accept gets it, as before; widening and expiry are unchanged.

| # | Device | Action | What judges see |
|---|---|---|---|
| 8 | Laptop 1 → Phone | New referral for **9876500010** (Anil) → Consent **Confirm by SMS** → **Send consent SMS to patient** | Doctor: “Consent: pending SMS”, **no lab sees anything**. Phone: Hindi + English “Reply YES or NO” |
| 9 | Phone | Tap **YES हाँ** | Labs get the request at once (offer window starts); doctor badge “Consent: granted via SMS” |
| 10 | Laptop 1 → Phone | Same for **9876500008** (Geeta, untick MRI, tick CT) → tap **NO नहीं** | Request cancelled, nothing shared, “keep your original date” SMS; badge “Consent: refused” |
| 11 | DHO login | **District dashboard** → map | Hospitals on a district map (no internet needed); circle colour = wait days, size = accepted; arrows = live referrals; tap a lab for details; filter by test and date range |

**Consent by SMS:** the verbal checkbox still works. In SMS mode the patient has 24 hours (demo clock) to reply. YES/HAAN/हाँ grants,
NO/NAHI/नहीं cancels, anything else gets a polite “please reply YES or NO” and changes nothing. A bundle asks once.

**District map:** inline SVG drawn from the facilities' coordinates (no map tiles, no API key, works offline). New KPIs: average
days saved, no-show rate, consent-by-SMS replies, lab acceptance rate. All KPIs and the map follow the test and date filters.

**Multi-test bundle (optional extra in the demo):** in *New referral* tick **MRI + CT**. One bundle (e.g. `NS-B501`) is created and the patient gets one SMS.
Labs that can do both (B, D) see one card with **“Accept all 2 here (one trip)”**; Lab C (MRI only) sees just the MRI, marked “part of bundle”.
One reply “1” confirms both tests, and the district dashboard counts **patient trips saved**.

The “days earlier” number is computed (original slot date − actual test date), so it says 14 when the test is done the same day. Say whatever the screen shows.

**Robustness moments to show:** two labs racing; double-click / refresh changes nothing; out-of-order buttons are disabled
and also rejected by the database; audit log is append-only (try `update tb.audit_log …`: the database refuses).

**Extra demo controls (Demo controls):** `+1h / +6h / +24h` moves the demo clock. An unaccepted request first **widens its radius**,
then **expires** (“keep your original date” SMS). A booked patient gets a **day-before reminder**. Lab **No-show** puts the
request back to open while the original slot stays held.

### Rehearsal check (run before going on stage)
```bash
npm run check:demo      # needs the app running + Chrome at /usr/bin/google-chrome (or CHROME=/path)
```
It presses **Reset demo data**, then plays the whole flow above across 4 simulated devices and prints `PASS`.
`npm run check:bundle` does the same for the multi-test bundle (MRI + CT, one trip).
**It resets the demo data**, so run it before you set up the real devices, not during the demo.

---

## Tests

| Command | What it checks | Needs |
|---|---|---|
| `npm test` | **34 automated tests** in `tests/**/*.test.ts` (Node's built-in test runner, no extra packages) | nothing |
| `npm run test:unit` | `tests/unit/`: DATABASE_URL repair, IST date formatting, phone masking, every status/consent label exists in Hindi + English | nothing |
| `npm run test:db` | `tests/db/`: the real `db/schema.sql` on a throwaway in-memory Postgres (PGlite): idempotent create, two-lab accept race (exactly one winner, loser audited), state machine rejects out-of-order steps, slot release to next patient, one report per referral, no-show reopen, append-only audit log, SMS dedupe, offer window + tie-breaks + bundle preference, SMS consent YES / NO / unclear / 24h expiry | nothing |
| `npm run test:e2e` | `check:demo` + `check:bundle`: the full demo in headless Chrome across 4 simulated devices | app running + Chrome |
| `npm run verify` | lint + typecheck + tests + production build | nothing |

Details: [docs/TESTING.md](docs/TESTING.md). Database tests never touch `./.data` or a running app. **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, typecheck, all tests and the build on every push and pull request, then starts the production server and runs both end-to-end rehearsals.

---

## Deploy

Deployment files in the repo: [Dockerfile](Dockerfile) (with healthcheck), [render.yaml](render.yaml) (Render Blueprint, persistent disk), [vercel.json](vercel.json) (Mumbai region `bom1`), [.env.example](.env.example). Every deployment exposes `GET /api/health` (200 when the database works, 503 otherwise, never shows the password).

**Option 0: Docker (any server or laptop).**
```bash
docker build -t nidaan-setu .
docker run -d -p 3000:3000 -v nidaan-data:/app/.data --name nidaan-setu nidaan-setu   # built-in database on a volume
# or with Postgres/Supabase: add  -e DATABASE_URL='postgresql://…:6543/postgres'
```

**Option A: one Node server with the built-in database (simplest).** Any host that runs a normal, always-on Node process:
Render “Web Service”, Railway, a college/VPS machine, or a laptop.
```bash
npm ci
npm run build
npm start            # listens on $PORT (default 3000) on all interfaces
```
Env vars: none needed (`DATABASE_URL` empty). Run **one** instance only (the local database lives on that machine’s disk).
On hosts without a persistent disk the demo data is recreated on every redeploy, which is fine for a demo.
Render: *New → Blueprint* picks up [render.yaml](render.yaml) (or set Build command `npm ci && npm run build`, Start command `npm start`, instance count 1, health check `/api/health`).

**Option B: Vercel + Supabase.** Vercel runs many short-lived copies of the app, so it needs a shared database:
1. Supabase project (region Mumbai) → **Connect** (top bar) → **Transaction pooler** → copy the URI (port **6543**), and put your real password in it.
   It must start with `postgresql://`. The `https://….supabase.co` Project URL is a different thing.
2. Vercel → *Settings → Environment Variables* → `DATABASE_URL` = that URI (no quotes, no `DATABASE_URL=` in the value), for **Production**.
   Optional: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` for instant updates.
3. **Redeploy** (env changes only apply to new deployments).
4. Open `https://<app>.vercel.app/api/health`. It should say `"ok": true`. On first use the app **creates the tables and demo data
   in Supabase by itself**; `npm run db:reset` from a laptop is optional.
5. If it says `"ok": false`, the `error` field tells you what's wrong (wrong password, placeholder left in, https URL, etc.).
   Special characters (`# / @ %`) in the password are encoded automatically.

> Security note for judges: the demo has no real login. Production design: real auth + Postgres row-level security by `hospital_id`.

---

## If the venue Wi-Fi fails

1. **Phone hotspot** (two phones, different carriers). Vercel + Supabase work over 4G. Nothing changes.
2. **No internet at all:** one laptop is the server (built-in database, nothing else needed).
   ```bash
   npm run start:lan                        # production build on 0.0.0.0:3000
   hostname -I                              # (Windows: ipconfig) → e.g. 192.168.43.12
   ```
   Other laptops/phones join the same hotspot (works without mobile data) and open `http://192.168.43.12:3000`.
   Build once while you still have internet (fonts are downloaded at build time).
3. **Last resort:** the recorded screen video (record it after the final rehearsal).

---

## How it works

- **Next.js 16** (App Router) + **Tailwind**; **Postgres**: built-in PGlite (default, file in `./.data`) or any Postgres server via `DATABASE_URL`.
- **All rules live in the database** ([db/schema.sql](db/schema.sql), schema `tb`). Every state change is one plpgsql function, one transaction:
  1. **idempotency key** (`tb.idempotency`): a retry or double click returns the stored result instead of acting twice;
  2. **compare-and-set** `UPDATE … WHERE status = 'open'`: concurrent accepts serialise on the row lock and exactly one wins;
  3. **audit row** in the same transaction (`tb.audit_log`, append-only by trigger), including failed attempts and data views.
- Messages are de-duplicated by a unique `dedupe_key`, so an SMS is never sent twice.
- One active referral per patient + test (partial unique index), one report per referral (unique constraint).
- Live screens poll `/api/live` every 2 s (Supabase Realtime, if configured, triggers an instant refresh). A dropped connection shows “retrying”, never a blank screen.
- Times are IST. `tb.app_now()` = real time + demo-clock offset.
- **Schema upgrades are automatic:** if the database has an older schema version, the app rebuilds the demo database on startup (synthetic data only).

```
db/schema.sql          tables + all tb.* functions (create, accept, offers, transition, report, reply, timers)
db/seed.sql            tb.reset_demo(): fictional district, hospitals A–F, tests, queue
lib/db.ts              PGlite or pg + rpc() helper          lib/queries.ts   read queries per screen
lib/useLive.ts         polling + realtime hook          app/actions.ts   server actions (all writes)
app/(app)/doctor       dashboard, new referral, hospital queue
app/(app)/r/[id]       referral detail + printable slip (QR)
app/(app)/lab          lab desk: incoming (score), booked/today, done
app/(app)/phone        simulated patient SMS phone      app/s/[token]    public patient status page
app/(app)/audit, dho   audit log, district dashboard     app/api/*        live polling, status, report PDF
```

## Honesty notes
- Test-preparation text in `db/seed.sql` is a **draft**: get a doctor to review it.
- No real statistics are in the app; every number on screen is computed from the demo data.
- ABDM/ABHA, NHM Free Diagnostics, PM-JAY: future integrations only, not built.
