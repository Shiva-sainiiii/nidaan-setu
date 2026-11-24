# HANDOFF — read this first in a new chat

Last updated: 2026-11-25. Keep this file current: after each finished module, update "Where we are" and "Next".

## Start a new chat like this
Open Claude Code **inside this folder** (`testbridge/`) so CLAUDE.md loads automatically, then say:

> Read HANDOFF.md and CLAUDE.md, then continue with <the next item>. Work module by module, test, then stop and report.

Before changing anything, check the app runs: `npm run dev` → http://localhost:3000, then `npm run check:demo`.

## What this is
**Nidaan Setu (निदान सेतु)** (formerly TestBridge). NexHack 2.0 hackathon MVP. A government doctor sends a diagnostic test to nearby partner labs. One lab accepts (atomic, in the database). The patient gets a Hindi+English SMS (simulated). The report goes back to the same doctor, and the original queue slot goes to the next patient.
Pitch: *Your doctor stays the same. Only the test moves.* All data is synthetic.

## Where we are (all done and tested)
| Area | State |
|---|---|
| DB schema + RPCs + seed (schema `tb`, version `nidaansetu-schema-v5`) | ✅ |
| Doctor, Lab, Patient phone, Status page `/s/[token]`, Audit, DHO dashboard | ✅ |
| Multi-test bundle (several tests, one trip, one SMS) | ✅ |
| Rename TestBridge → Nidaan Setu (UI, SMS, PDF, package, docs) | ✅ |
| UI redesign: government look + animations (drifting background, hover lift, shine buttons, count-up stats, landing page with FlowDiagram, SVG icons) | ✅ |
| **Feature 1: offer window + earliest slot** (2026-11-25) | ✅ |
| **Feature 2: consent by SMS** (2026-11-25) | ✅ |
| **Feature 3: DHO district map** (2026-11-25) | ✅ |
| check:sql 44/44 · check:demo 47s (incl. offers, YES/NO consent, map) · check:bundle · `next build` | ✅ |
| `npm run check:demo`, `check:bundle`, `check:sql` | ✅ PASS |
| `npx next build` | ✅ |
| Deployable zip `../nidaan-setu.zip` | ✅ (rebuild after changes, see below) |

## Next (ask the user which one; do one at a time)
0. All 3 features from [FEATURES_BRIEF.md](FEATURES_BRIEF.md) are done. Ideas: a mobile pass of the remaining screens, and deploying to Vercel.
1. **Mobile layout pass** (lab staff and patients use phones): check every page at 375px width.
2. **Polish** the New Referral form (`app/(app)/doctor/new/NewReferralForm.tsx`) and the referral detail page (`app/(app)/r/[id]/ReferralDetail.tsx`) to match the new look.
3. Optional: move `SKILL.md` to `.claude/skills/ui-ux-pro-max/SKILL.md`.
4. **Deploy:** the live Vercel app (Supabase, Mumbai pooler) runs the team's older edited code, not this repo. Deploy this repo to get the features. The first start auto-rebuilds the Supabase demo DB (schema v3), which wipes old test referrals once.
5. Pitch work: fill the `[PLACEHOLDER]` quotes in PLAN.md with real doctor or lab quotes; record the backup demo video.

## Feature 1 design (offer window)
- `tb.offer_collect_window(priority)`: P1 0 (first Accept wins, the old race), P2 1h, P3 4h. Stored in `referrals.offers_close_at`.
- Labs call `tb.offer_slot` / `tb.offer_bundle` (one row per lab per referral in `tb.referral_offers`). `accept_referral` is refused while the window is open.
- `tb.close_offers` runs from `process_timers` (window over) or as soon as every lab has offered or declined. Ranking: whole-bundle cover → earliest slot → km → free → offered first. The explanation goes in `referrals.selection` (shown in the "Offer window" card on `/r/[id]`).
- Booking side effects live in `tb.after_booking` (shared by direct accept and selection). Lock order: `tb.lock_group` (referral + bundle siblings, id order).

## Feature 2 design (consent by SMS)
- `referrals.consent_mode` (verbal|sms), `consent_status` (verbal|pending_sms|granted_sms|refused|expired), `consent_requested_at/answered_at`. The check constraint allows `consent_recorded=false` only for pending/refused/expired.
- SMS mode: `create_referral` adds **no recipients** and sets `expires_at = now + tb.consent_timeout()` (24h). `labView` also filters on consent_status.
- `tb.patient_reply`: YES-words grant all pending requests of the patient (add_recipients and start the offer window), NO-words cancel them, anything else sends a hint. "1" still confirms bookings.
- `process_timers` step 0 expires unanswered consent.

## Feature 3 design (DHO map)
- `dhoView(filter)` in `lib/queries.ts`: every number comes from the CTE `f` (test + days filter). Read-only. `/api/live?view=dho&test=MRI&days=7`.
- `components/DistrictMap.tsx`: equirectangular projection of lat/lng into SVG. No tiles, so it works offline. On phones it pans sideways inside the card.

## Gotchas (learned the hard way)
- **Page reloads every second in dev** (HMR loop, login bounces to `/`): stop the server, `rm -rf .next`, start again.
- Changing SQL without bumping the version: the running local DB keeps the old functions. Stop the app, `npm run db:reset`, start again.
- **Styles missing in dev** after CSS edits: stop the server, `rm -rf .next`, start again.
- **Don't create files in the project root while `npm run dev` runs.** Hot reload logs you out mid-test. Put scripts in `scripts/`.
- The first check after a server restart can time out while pages compile. Open the pages once with curl first.
- To stop the server, kill it by port (`ss -ltnp | grep 3000`), not `pkill -f` (that matches its own shell).
- Both check scripts **reset the demo data**.
- Schema change: bump `SCHEMA_VERSION` in `lib/db.ts` **and** the `comment on schema tb` line in `db/schema.sql`.
- `DATABASE_URL` empty = local PGlite (`./.data/pglite`). Set = Postgres/Supabase (Transaction pooler, port 6543). A password containing `#`, `/` or `@` is handled by `lib/dburl.ts`.
- Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).

## Security (must follow)
- `image.png` in this folder contains the **Supabase DB password**. Never commit, zip, upload or paste it. Delete it when possible, and reset the Supabase password after the hackathon.
- Never commit or zip `.env.local` or any `.env*` except `.env.example`.

## Rebuild the zip
```
cd /home/aatish_chauhan/User/aatish/hackathon
rm -rf /tmp/ns && mkdir -p /tmp/ns/nidaan-setu
rsync -a --exclude node_modules --exclude .next --exclude .data --exclude '.env.local' \
  --exclude '*.tsbuildinfo' --exclude image.png testbridge/ /tmp/ns/nidaan-setu/
rm -f nidaan-setu.zip && (cd /tmp/ns && zip -qr /home/aatish_chauhan/User/aatish/hackathon/nidaan-setu.zip nidaan-setu)
unzip -l nidaan-setu.zip | grep -Ei 'image.png|\.env.local' || echo "no secrets in zip"
```

## Where things are
- Plan, demo script, judge Q&A: `PLAN.md`. Run and deploy: `README.md`. Rules and module table: `CLAUDE.md`.
- SQL: `db/schema.sql`, `db/seed.sql`. DB access: `lib/db.ts`. Read queries: `lib/queries.ts`. Mutations: `app/actions.ts`.
- UI kit: `components/ui.tsx`, `components/Icon.tsx`, styles and motion in `app/globals.css`.
