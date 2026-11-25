# Nidaan Setu documentation

Nidaan Setu (निदान सेतु) lets a government-hospital doctor send a diagnostic test (MRI, CT, ECHO …) to a nearby partner lab with free slots. The report returns to the same doctor, and the patient's original queue slot goes to the next patient.

All data in this project is synthetic.

| Document | Read it to … |
|---|---|
| [Architecture](ARCHITECTURE.md) | understand the parts, the request flow and the design decisions |
| [Database](DATABASE.md) | see every table, the referral state machine and every `tb.*` function |
| [API reference](API.md) | call the HTTP endpoints and server actions |
| [User guide](USER_GUIDE.md) | use the app as a doctor, lab, patient or district health officer |
| [Testing](TESTING.md) | run and write unit, database and end-to-end tests |
| [Deployment](DEPLOYMENT.md) | run it with Docker, Render, Vercel + Supabase or offline on a LAN |
| [Security & privacy](../SECURITY.md) | see what the demo protects and what production needs |
| [Contributing](../CONTRIBUTING.md) | follow the code rules and the pull-request checklist |
| [Changelog](../CHANGELOG.md) | see what changed |

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000. The built-in database is created and seeded on first start.
npm test             # 34 unit + database tests, no setup needed
```
