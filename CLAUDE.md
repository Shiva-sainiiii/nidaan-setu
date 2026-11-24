# Nidaan Setu — working notes

Hackathon MVP (NexHack 2.0, 24h). Full plan, scope and demo script: [PLAN.md](PLAN.md).
Pitch: *Your doctor stays the same. Only the test moves.* ALL DATA IS SYNTHETIC.

## How we work
Build **one module at a time**, compile + test it, then stop for review before the next module.

## Stack
- Next.js 16 (App Router, React Compiler, `cacheComponents` OFF) + Tailwind v4.
- Postgres: built-in **PGlite** stored in `./.data/pglite` when `DATABASE_URL` is empty (default, auto-created + seeded on first start); real Postgres via `pg` when `DATABASE_URL` is set (Supabase/Docker). Same SQL. See [lib/db.ts](lib/db.ts).
- All tables and functions live in schema `tb`. **Every state change is a `tb.*` plpgsql function**
  called through `rpc()` in [lib/db.ts](lib/db.ts): idempotency key → compare-and-set UPDATE → audit row, one transaction.
- Live screens poll `/api/live?view=…` every 2s ([lib/useLive.ts](lib/useLive.ts)); Supabase Realtime is optional and only triggers refetch.
- Demo login = cookie `tb_user` with a `tb.demo_users.id` (no real auth; say so to judges).
- Times are IST. `tb.app_now()` = real time + demo clock offset.

## Commands
```
npm run dev        # http://localhost:3000 (creates ./.data/pglite with demo data on first start)
npm run build && npm start   # production, 0.0.0.0:$PORT
npm run db:reset   # local mode: delete ./.data (STOP the app first); Postgres mode: apply schema+seed
npm run db:docker  # optional Docker Postgres (then set DATABASE_URL)
npm run check:demo # full demo rehearsal in headless Chrome (RESETS demo data)
npm run check:bundle # same for the multi-test bundle flow
npm run start:lan  # production build on 0.0.0.0:3000 (no-Wi-Fi fallback)
```

## Schema changes
Bump `SCHEMA_VERSION` in [lib/db.ts](lib/db.ts) **and** the `comment on schema tb` line at the end of `db/schema.sql` together. The app then rebuilds the demo database automatically (local and Supabase).

## UI design rules (government / public-service look)
- Colours: `brand-*` navy (tokens in [app/globals.css](app/globals.css)) for identity and primary actions; emerald/amber/rose/sky **only** for status meaning; `india-*` only for the thin tricolour strip. No gradients.
- Every button/link/input is at least 44px tall (`min-h-11`); never remove the focus outline; body text 16px, nothing below 12px.
- Icons are SVG (no emoji as icons). Hindi text gets `lang="hi"`.
- Honest identity: "Pilot concept · synthetic demo data · not an official government service". No national emblem.

## Rules
- Never write referral state from TS directly; add/extend a `tb.*` function instead.
- Client mutations pass a key from `useIdemKey()`; rotate it after any definitive result (ok or not), keep it on network errors.
- No invented statistics in UI or pitch; computed numbers only.

## Module status
| Module | Status |
|---|---|
| 1. Database (schema, RPCs, seed, reset) | ✅ tested in psql |
| 2. App shell (db, session, live polling, header, login, demo controls) | ✅ |
| 3. Doctor (dashboard, new referral, referral detail, slip, hospital queue) | ✅ |
| 4. Lab desk (incoming + score, accept race, today, upload report) | ✅ browser-tested (2-lab race) |
| 5. Patient (phone panel, public status page `/s/[token]`) | ✅ browser-tested |
| 6. Audit log page + DHO dashboard | ✅ browser-tested |
| 8. Multi-test bundle (several tests, one patient, one trip) | ✅ browser-tested (bundle race, one SMS, reply confirms all) |
| 7. End-to-end demo run, README, deploy guide | ✅ demo passes twice in a row (`npm run check:demo`); deploy waits for team accounts (README) |
