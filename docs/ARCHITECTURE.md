# Architecture

## Overview

```
 Browser (doctor / lab / DHO / patient phone / public status page)
   │  server actions (writes)            GET /api/live?view=…  every 2 s (reads)
   ▼                                      ▼
 Next.js 16 App Router (app/)  ──────►  lib/queries.ts  (read-only SQL per screen)
   │ app/actions.ts                      lib/db.ts      (PGlite or pg, rpc() helper)
   ▼                                      │
 rpc("tb.<function>", args) ─────────────►│
                                          ▼
                     Postgres, schema `tb` (db/schema.sql)
                     all business rules as plpgsql functions
```

| Layer | Where | Responsibility |
|---|---|---|
| UI | `app/(app)/*`, `app/s/[token]`, `components/` | Screens per role. Client components poll `/api/live` through `lib/useLive.ts`. |
| Writes | `app/actions.ts` | Server actions. Each one checks the role from the session cookie, then calls exactly **one** `tb.*` function. |
| Reads | `lib/queries.ts`, `app/api/live/route.ts` | One query function per screen (`doctorView`, `labView`, `dhoView`, …). Read-only. |
| Database access | `lib/db.ts`, `lib/dburl.ts` | Picks the built-in PGlite (`./.data/pglite`) or `pg` (when `DATABASE_URL` is set). Creates or upgrades the schema automatically. |
| Business rules | `db/schema.sql` | Tables, constraints, and every state change as a plpgsql function. |
| Demo data | `db/seed.sql` | `tb.reset_demo()`: fictional district, hospitals A–F, tests, queue, patients. |

## Design decisions

1. **The database holds every rule.** TypeScript never writes referral state directly. A two-lab race, a double click or a network retry is decided inside one Postgres transaction, so the UI cannot get it wrong.
2. **Every state-changing function follows the same pattern** in one transaction:
   1. `tb.idem_begin(key)`. If the key was seen before, return the stored result.
   2. A compare-and-set `UPDATE … WHERE status = <expected>`. Only one concurrent caller wins.
   3. `tb.audit(...)` writes success *and* failure to the append-only audit log.
   4. `tb.send_msg(..., dedupe_key)`. The SMS row is unique per key, so it is never sent twice.
   5. `tb.idem_end(key, result)`.
3. **Polling, not sockets.** `/api/live` is polled every 2 s. It works on any host and degrades gracefully. Supabase Realtime is optional and only triggers a refetch.
4. **Timers without cron.** `tb.process_timers()` runs at most every 30 s when `/api/live` is called. It handles consent expiry, closing offer windows, radius widening, referral expiry and reminders. The demo clock (`tb.app_now()` = now + offset) lets you test time-based rules instantly.
5. **Same SQL everywhere.** PGlite (embedded Postgres in WASM) for laptops and tests; any Postgres (Supabase, Docker) in production.
6. **Automatic schema upgrades.** `SCHEMA_VERSION` in `lib/db.ts` must match the `comment on schema tb` in `db/schema.sql`. On a mismatch the demo database is rebuilt.

## Main flow

```
Doctor creates referral ──► consent? ── SMS mode ──► patient replies YES ─┐
   (create_referral)          │ verbal                                    │
                              ▼                                           ▼
                labs within radius notified (add_recipients, score)
                              │
          P1: first Accept wins (accept_referral, compare-and-set)
          P2/P3: offer window (offer_slot) ──► close_offers picks the earliest slot
                              │
                 patient SMS, original slot held as backup (after_booking)
                              │
      patient replies "1" ─► arrived ─► test_done ─► report uploaded ─► closed
                                           │
                     original slot released to the next waiting patient
```

## Folder map

```
app/            routes (App Router). (app)/ = logged-in screens; s/[token] = public status page; api/ = HTTP endpoints
components/     shared UI (ui.tsx kit, DistrictMap, Timeline, Header, Icon …)
lib/            db.ts, dburl.ts, queries.ts, session.ts, format.ts (labels in Hindi + English), useLive.ts
db/             schema.sql (tables + functions), seed.sql (demo data)
tests/          unit/ and db/ tests (node:test), helpers/
scripts/        db-setup, end-to-end browser rehearsals (demo-check, bundle-check)
docs/           this documentation
```
