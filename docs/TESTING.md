# Testing

Three levels. None needs extra packages: Node's built-in test runner (`node:test`) runs TypeScript test files directly (Node ≥ 22.18), and the browser tests use `playwright-core` with an installed Chrome.

| Command | Level | Needs | Time |
|---|---|---|---|
| `npm test` | unit + database (34 tests) | nothing | ~10 s |
| `npm run test:unit` | unit only | nothing | <1 s |
| `npm run test:db` (alias `check:sql`) | database only | nothing | ~10 s |
| `npm run test:e2e` | end-to-end demo in headless Chrome | app running, Chrome | ~1–2 min |
| `npm run verify` | lint + typecheck + tests + production build | nothing | ~1 min |

## Unit tests: `tests/unit/`
- `dburl.test.ts`: repairs and validates `DATABASE_URL`: empty means local, pasted quotes, https URL rejected, placeholder rejected, special characters encoded.
- `format.test.ts`: IST dates, relative times, phone masking. Also checks that every status and consent label exists in English **and** Hindi (Devanagari).

## Database tests: `tests/db/`
Each file starts a fresh **in-memory Postgres** (PGlite) with the real `db/schema.sql` and `db/seed.sql`, through `freshDb()` in `tests/helpers/db.ts`. They never touch `./.data` or a running app.

| File | Covers |
|---|---|
| `referral-core.test.ts` | Idempotent create (double submit gives one referral); consent required; one active referral per patient + test; **two-lab accept race gives exactly one winner, and the loser is audited**; idempotent accept sends no second SMS; out-of-order and wrong-lab steps rejected; full lifecycle releases the original slot to the next patient; one report per referral; no-show reopens; audit log is append-only; SMS dedupe |
| `offer-window.test.ts` | Accept refused during the window; offer retry replayed; earliest slot wins when the window closes; window closes early when all labs answered; same slot → nearer lab; P1 has no window; bundle at one lab beats an earlier single slot (one combined SMS); no offers → stays open |
| `consent.test.ts` | SMS mode hides the referral from labs; unclear reply changes nothing; `Yes.` grants (retry replayed); `नहीं` cancels and keeps the original slot; 24 h without a reply expires; one `haan` unlocks a whole bundle; verbal flow and reply `1` unchanged; consent steps audited |

Writing a new one:

```ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, type Db } from "../helpers/db.ts";

let t: Db;
before(async () => { t = await freshDb(); });
after(async () => { await t.close(); });

test("my rule", async () => {
  const c = await t.create("9876500001", ["MRI"], "P1");          // seeded demo patient
  const r = await t.ref(c.code);
  assert.equal((await t.rpc("accept_referral", "lab-b", t.key(), r.id, await t.at(1))).ok, true);
});
```

Helpers: `rpc(fn, ...args)`, `row(sql)`, `count(sql)`, `ref(code)`, `create(phone, tests, priority, extra)`, `at(days, "HH:MM")` (on the demo clock), `msgs(patientId)`, `audits(action, refId)`, `reply(patientId, body)`, `key()`.

## End-to-end: `scripts/demo-check.mjs`, `scripts/bundle-check.mjs`
These play the full pitch demo across 4 browser "devices": reset, create, two-lab race, SMS, confirm, arrived, test done, report upload, "days earlier", slot release and audit. They also cover the offer window, SMS consent YES and NO, and the DHO map with its filters. They **reset the demo data**.

```bash
npm run dev                  # in one terminal
npm run test:e2e             # in another (CHROME=/path/to/chrome if not /usr/bin/google-chrome; BASE=http://host:port)
```

## Continuous integration
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and pull request:
1. **verify**: `npm ci`, lint, typecheck (`next typegen && tsc`), `npm test`, `npm run build`.
2. **e2e**: builds, starts the production server, waits for `/api/health`, then runs both browser rehearsals.
