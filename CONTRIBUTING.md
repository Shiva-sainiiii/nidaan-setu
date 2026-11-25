# Contributing

## Setup
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # must pass before every commit
```

## Rules
1. **Every state change is a `tb.*` plpgsql function** in `db/schema.sql`. Each one uses: idempotency key → compare-and-set `UPDATE` → `tb.audit(...)` → `tb.send_msg(..., dedupe_key)`. Never write referral state from TypeScript.
2. **Client mutations pass an idempotency key** from `useIdemKey()`.
3. **No hardcoded numbers in the UI.** Everything shown is computed from data.
4. **Every new user-facing string comes in English and Hindi**, using the plain dictionaries in `lib/format.ts`; Hindi text gets `lang="hi"`.
5. **Schema change:** bump `SCHEMA_VERSION` in `lib/db.ts` and the `comment on schema tb` line together.
6. **Accessibility:** controls are at least 44 px tall (`min-h-11`), focus outlines stay, icons are SVG.
7. **New database behaviour gets a test** in `tests/db/` (see [docs/TESTING.md](docs/TESTING.md)).

## Pull-request checklist
- [ ] `npm run verify` passes (lint, typecheck, tests, build)
- [ ] `npm run test:e2e` passes if the UI flow changed
- [ ] Docs updated (`docs/`, README, CHANGELOG)
- [ ] No secrets, `.env*` files or real patient data
