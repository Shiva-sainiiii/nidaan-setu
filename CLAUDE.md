# Nidaan Setu — working notes

**New chat? Read [HANDOFF.md](HANDOFF.md) first**: current state, next steps, gotchas, security rules. Update it after every finished module.

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
npm test           # 34 unit + database tests (in-memory Postgres; safe, no app needed)
npm run verify     # lint + typecheck + tests + build (same as CI)
npm run test:e2e   # check:demo + check:bundle (app must be running)
npm run start:lan  # production build on 0.0.0.0:3000 (no-Wi-Fi fallback)
```

## Schema changes
Bump `SCHEMA_VERSION` in [lib/db.ts](lib/db.ts) **and** the `comment on schema tb` line at the end of `db/schema.sql` together. The app then rebuilds the demo database automatically (local and Supabase).

## UI design rules (government / public-service look)
- Colours: `brand-*` navy (tokens in [app/globals.css](app/globals.css)) for identity and primary actions; emerald/amber/rose/sky **only** for status meaning; `india-*` only for thin accents.
- Motion (CSS only, transform/opacity, all off under prefers-reduced-motion): drifting `Ambient` background, `.page-enter` (app/(app)/template.tsx), `.stagger` lists, `.surface` + `.lift` cards, `.btn-shine` primary buttons, `CountUp` numbers, `FlowDiagram` on the landing page.
- Shared pieces: `Card`/`Stat`/buttons in [components/ui.tsx](components/ui.tsx), SVG icons in [components/Icon.tsx](components/Icon.tsx).
- If styles look missing in dev after editing globals.css: stop the dev server, `rm -rf .next`, start again (stale Turbopack cache).
- Every button/link/input is at least 44px tall (`min-h-11`); never remove the focus outline; body text 16px, nothing below 12px.
- Icons are SVG via `<Icon name=…>` (no emoji as icons). Hindi text gets `lang="hi"`.
- Honest identity: "Pilot concept · synthetic demo data · not an official government service". No national emblem.

## Rules
- New DB behaviour gets a test in `tests/db/` (use `freshDb()` from `tests/helpers/db.ts`). Docs live in `docs/`; update them with each change.
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
| 9. Offer window + earliest slot (`tb.offer_slot`, `offer_bundle`, `close_offers`; P1 = no window) | ✅ check:sql 28/28, check:demo offer scenario |
| 10. Consent by SMS (`consent_mode/status`, `patient_reply` YES/NO, 24h timeout) | ✅ check:sql 44/44, check:demo YES + NO |
| 11. DHO map view (inline SVG `components/DistrictMap.tsx`, filters, new KPIs; read-only) | ✅ check:demo map scenario |
| 12. Tests + CI + deploy files (`tests/`, `.github/workflows/ci.yml`, Dockerfile, render.yaml, vercel.json) | ✅ 34/34, Docker image healthy |
| 7. End-to-end demo run, README, deploy guide | ✅ demo passes twice in a row (`npm run check:demo`); deploy waits for team accounts (README) |
