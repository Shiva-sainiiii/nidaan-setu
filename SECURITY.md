# Security & privacy

**This is a hackathon pilot with synthetic data only.** No real patient data may be entered.

## What the demo already does
- **Consent before sharing.** Either the doctor records verbal consent, or the patient replies YES by SMS. In SMS mode, labs cannot see the referral until consent is given.
- **Data minimisation.** Labs see the test, priority, distance and a short note. Name and phone are shown only to the lab that booked, and every such view is written to the audit log.
- **Append-only audit log.** A database trigger blocks UPDATE and DELETE.
- **Integrity in the database.** Idempotency keys, compare-and-set updates, unique constraints (one report per referral, one active referral per patient and test, SMS dedupe).
- **The public status page** uses an unguessable random token and shows minimal data.
- **Report upload** accepts PDF only (checked by magic bytes, not just the file name) and at most 4 MB.
- **Secrets stay out of the repo.** `.env*` files are git-ignored (except `.env.example`), and `/api/health` never returns the password.

## Known demo limitations (and the production design)
| Demo | Production |
|---|---|
| Demo login picker (cookie with a user id) | Real authentication (e.g. hospital SSO / OTP) |
| One database role for the app | Postgres row-level security by `hospital_id` |
| Simulated SMS | DLT-registered SMS templates or the WhatsApp Business API |
| `/phone` and `/audit` are open for the demo | Restricted to admins |
| Verbal or SMS consent | Consent aligned with the DPDP Act 2023 / ABDM consent flows |

## Reporting a problem
Please open a private issue or contact the team instead of a public issue. If a credential was ever committed, **rotate it immediately**: deleting the file does not remove it from git history.
