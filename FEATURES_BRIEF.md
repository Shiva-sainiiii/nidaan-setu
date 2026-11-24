# Feature brief: 3 new features (from the team, 2026-11-25)

Status: all 3 features ✅ done and tested (2026-11-25). See HANDOFF.md.

## Non-negotiable rules
1. Every state change is a plpgsql function (schema `tb`), in one transaction. No multi-step writes from TypeScript.
2. Every mutating function takes an idempotency key (`tb.idem_begin` / `tb.idem_end`). A double click or retry must not repeat anything.
3. Compare-and-set: `UPDATE ... WHERE status = ...`. Only one winner in a race.
4. Every action goes to audit_log through `tb.audit(...)`, failed attempts included.
5. SMS goes through `tb.send_msg` with a `dedupe_key`, so no SMS is sent twice.
6. No hardcoded numbers. Every number on screen is computed from data.
7. New strings in both Hindi and English, using the existing plain TS dictionary. No i18n library.
8. No new packages. When the schema changes, bump the schema version so the old demo DB auto-rebuilds. Also update `db/seed.sql` and `tb.reset_demo()`.
9. The existing flow must not break. `npm run check:demo` and `npm run check:bundle` must PASS. The bundle flow (`tb.create_bundle`, `tb.accept_bundle`) must also work correctly with the new features.

## Feature 1: Offer window + earliest slot ✅
- When a referral is created, a short offer window opens. Reuse or extend `tb.offer_window`. For P1 the window can be short or zero, so urgent cases are not delayed.
- During the window, labs **offer** their slot instead of accepting. One active offer per lab per referral.
- When the window ends, the earliest slot wins. Tie-breaks: shorter distance, then the free lab, then the earlier offer. The winner gets the same effects as an accept today. The other labs are marked `lost_race` or `not_selected` and see "Already accepted by ...".
- If no offer arrives in the window, the existing behaviour stays (radius widens, then the referral expires).
- Lab desk: an "Offer slot" button and a countdown. Doctor page: how many offers arrived, which won, and why ("earliest slot: 3 Dec vs 5 Dec").
- Window expiry can be tested with the demo clock. For bundles, an offer that covers all tests at one lab is preferred.

## Feature 2: Consent by SMS ✅
**Today:** the doctor only ticks a checkbox ("the patient gave verbal consent"). `consent_recorded` must be NOT NULL true.

**Needed:**
- A consent mode on the doctor form: **"Verbal (checkbox)"** or **"Confirm by SMS"**.
- In SMS mode the referral is created with `consent_status = pending_sms`. The patient gets an SMS in both languages: "May we share your test details with partner labs? Reply YES / NO".
- **Until YES arrives:** labs must not see the referral. `tb.add_recipients` must not run, and the lab queries (`labView`) must exclude it. Labs see the patient's personal data only after consent.
- Extend `tb.patient_reply` (it handles "1" today):
  - `YES`/`HAAN`/`हाँ` → consent granted, recipients added, labs notified.
  - `NO`/`NAHI`/`नहीं` → referral cancelled, the patient's original slot is unchanged, and a "keep your original date" SMS is sent.
  - Replies are case-insensitive and trimmed. If a reply isn't understood, send one polite "please reply YES or NO" SMS and change no state.
- Consent timeout, using the demo clock (e.g. 24h): if there's no reply, the referral expires and the doctor sees "consent pending/expired".
- Audit: the consent mode, when consent was asked for, and when it was given or refused.
- A consent status badge on the doctor's referral page: Verbal / Pending SMS / Granted via SMS / Refused.
- Show this SMS and the reply flow on the simulated `/phone`. Show the consent-pending state on the `/s/[token]` status page too.
- The old verbal checkbox flow keeps working (backward compatible).

## Feature 3: Map view on the DHO dashboard ✅
**Today:** the DHO dashboard (`app/(app)/dho/DhoView.tsx`, `dhoView()` in `lib/queries.ts`) only has numbers and tables.

**Needed:**
- A **district map** on the dashboard, with one marker per hospital (A–F) from the lat/lng in `tb.hospitals`.
  - No paid map API and no API key. Use **Leaflet + OpenStreetMap tiles**, or, if the package isn't allowed, an inline SVG map that scales lat/lng.
  - In offline `start:lan` mode the page must not crash: if tiles don't load, show the markers and distance rings.
- Marker colour/size shows **utilisation**, computed from data: the lab's current wait days, or how many referrals it accepted in a day. Hospital A (the referrer) gets a different icon.
- On marker click/hover: hospital name, govt/PPP, free/paid, tests, current wait days, today's accepted/done referrals, average time to accept.
- For active referrals (only `accepted`..`report_sent`), a **line/arrow** from A to the accepting lab. It updates live through `/api/live` polling and the existing `useLive` hook.
- Filters: test type (MRI/CT/...) and a date range. Changing a filter updates both the markers and the KPIs.
- New KPIs, all computed: acceptance rate per lab, average wait days saved, no-show rate. The existing "trips saved" and other KPIs stay.
- Works on mobile. Hindi/English labels.
- Add a new read query in `lib/queries.ts` or extend `dhoView`. This feature must not write anything.

## How to work
1. Write a short plan first (which files change, schema changes, new functions). Then implement.
2. Order: Feature 1 → Feature 2 → Feature 3. Run and test the app after each feature.
3. Add new scenarios to `scripts/demo-check.mjs`:
   - Offer window: 2 labs offer different slots and the earlier one wins.
   - SMS consent: YES moves the flow forward, NO cancels it.
   - Map: the page loads and the markers show.

   Then make `npm run check:demo` and `npm run check:bundle` both PASS. That script resets the demo data.
4. Update the demo flow table in README.md with the new steps, and the module status in CLAUDE.md.
5. In the final summary, say what changed, the new DB functions/columns, and what was tested.
