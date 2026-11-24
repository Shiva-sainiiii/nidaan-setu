# TestBridge

> **Your doctor stays the same. Only the test moves, to wherever it can be done fastest.**
> आपका डॉक्टर वही रहेगा। सिर्फ़ जाँच वहाँ होगी जहाँ सबसे जल्दी हो सके।

A government-hospital doctor whose MRI/CT/ECHO queue is weeks long sends a **test referral** to nearby partner labs.
One lab accepts a slot (exactly one, guaranteed by the database), the patient gets an SMS in Hindi + English,
the report comes back to the original doctor, and the patient's original queue slot is released to the next patient.

NexHack 2.0 · Open Innovation · **all hospitals, patients and phone numbers are fictional (synthetic data).**
Full plan, judge Q&A and pitch: [PLAN.md](PLAN.md). Code conventions and module status: [CLAUDE.md](CLAUDE.md).

---

## Run it locally (5 minutes)

Needs Node 20+ and Docker.

```bash
npm install
cp .env.example .env.local      # default points at the local Docker database
npm run db:local                # starts Postgres in Docker (container "testbridge-db", port 54329)
npm run db:setup                # creates schema "tb" + loads demo data
npm run dev                     # http://localhost:3000
```

`npm run db:setup` wipes and reloads everything. During a demo use **Demo ⚙ → Reset demo data** in the header instead.

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
| 1 | Laptop 1: doctor | New referral → **Use demo patient** → tick consent → **Send to 3 labs** | Original slot 14 days away, 3 labs within 25 km (2 free) |
| 2 | Laptops 2 + 3: Lab B, Lab C | Request pops up on both (with a beep). Both press **Accept** together | One gets “Accepted”, the other “**Already accepted by …**” |
| 3 | Phone: `/phone` | Hindi + English SMS arrives; tap **1** | Status link opens `/s/…` in Hindi; shows “confirmed” |
| 4 | Winning lab, tab **Booked / today** | **Arrived** → **Test done** → **Use sample report** → **Upload & send** | Upload is only possible in the right order |
| 5 | Laptop 1 | Referral page, then **Hospital queue** | “**Report ready: 14 days earlier**”; original slot moved to Pooja Rani |
| 6 | Any | **Audit log** | Every action incl. the losing accept and every view of patient data |

The “days earlier” number is computed (original slot date − actual test date), so it says 14 when the test is done the same day. Say whatever the screen shows.

**Robustness moments to show:** two labs racing; double-click / refresh changes nothing; out-of-order buttons are disabled
and also rejected by the database; audit log is append-only (try `update tb.audit_log …`: the database refuses).

**Extra demo controls (Demo ⚙):** `+1h / +6h / +24h` moves the demo clock. An unaccepted request first **widens its radius**,
then **expires** (“keep your original date” SMS). A booked patient gets a **day-before reminder**. Lab **No-show** puts the
request back to open while the original slot stays held.

### Rehearsal check (run before going on stage)
```bash
npm run check:demo      # needs the app running + Chrome at /usr/bin/google-chrome (or CHROME=/path)
```
It presses **Reset demo data**, then plays the whole flow above across 4 simulated devices and prints `PASS`.
**It resets the demo data**, so run it before you set up the real devices, not during the demo.

---

## Deploy (Supabase + Vercel)

**1. Database (Supabase, free tier)**
1. Create a project at supabase.com (region: Mumbai `ap-south-1`).
2. *Project Settings → Database → Connection string*: copy the **Transaction pooler** URI (port **6543**); put your DB password in it.
3. From your laptop: `DATABASE_URL="<that URI>" npm run db:setup`
   (it detects Supabase and also runs `db/supabase-realtime.sql` for instant updates).
4. *Project Settings → API*: note the **Project URL** and the **anon public** key.

**2. App (Vercel)**
1. Push this folder to GitHub (`.env.local` is git-ignored; never commit it).
2. vercel.com → *Add New Project* → import the repo.
3. Environment variables:
   - `DATABASE_URL` = the transaction pooler URI
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL *(optional: instant updates; without it screens poll every 2 s)*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key *(optional, same)*
4. Deploy. Open the URL, log in, **Demo ⚙ → Reset demo data**, then run `BASE=https://<your-app>.vercel.app npm run check:demo`
   with `DATABASE_URL` set to the Supabase URI.

> Security note for judges: the demo has no real login and the anon key can read the (synthetic) tables. Production design:
> real auth + Postgres row-level security scoped by `hospital_id`.

---

## If the venue Wi-Fi fails

1. **Phone hotspot** (two phones, different carriers). Vercel + Supabase work over 4G. Nothing changes.
2. **No internet at all:** one laptop is the server.
   ```bash
   npm run db:local && npm run db:setup     # local Docker Postgres
   npm run start:lan                        # production build on 0.0.0.0:3000
   hostname -I                              # (Windows: ipconfig) → e.g. 192.168.43.12
   ```
   Other laptops/phones join the same hotspot (works without mobile data) and open `http://192.168.43.12:3000`.
   Rehearse this once before the demo. Fonts are bundled at build time, so build while you still have internet.
3. **Last resort:** the recorded screen video (record it after the final rehearsal).

---

## How it works

- **Next.js 16** (App Router) + **Tailwind**; **Postgres** via `pg`. Works on local Docker Postgres or Supabase.
- **All rules live in the database** ([db/schema.sql](db/schema.sql), schema `tb`). Every state change is one plpgsql function, one transaction:
  1. **idempotency key** (`tb.idempotency`): a retry or double click returns the stored result instead of acting twice;
  2. **compare-and-set** `UPDATE … WHERE status = 'open'`: concurrent accepts serialise on the row lock and exactly one wins;
  3. **audit row** in the same transaction (`tb.audit_log`, append-only by trigger), including failed attempts and data views.
- Messages are de-duplicated by a unique `dedupe_key`, so an SMS is never sent twice.
- One active referral per patient + test (partial unique index), one report per referral (unique constraint).
- Live screens poll `/api/live` every 2 s (Supabase Realtime, if configured, triggers an instant refresh). A dropped connection shows “retrying”, never a blank screen.
- Times are IST. `tb.app_now()` = real time + demo-clock offset.

```
db/schema.sql          tables + all tb.* functions (create, accept, transition, report, reply, timers)
db/seed.sql            tb.reset_demo(): fictional district, hospitals A–F, tests, queue
lib/db.ts              pg pool + rpc() helper          lib/queries.ts   read queries per screen
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
