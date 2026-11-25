# Changelog

## 0.1.0 (2026-11-25, NexHack 2.0)

### Added
- **Core referral flow**:
  - doctor creates a referral;
  - labs within the radius are notified with a transparent score;
  - an atomic accept means exactly one lab wins a race;
  - bilingual SMS to the patient;
  - arrived → test done → PDF report;
  - the original queue slot is released to the next patient.
- **Multi-test bundle**: several tests, one trip, one SMS.
- **Offer window + earliest slot** (P2/P3): labs offer slots and the earliest wins. Tie-breaks: whole bundle, shorter distance, free lab, first offer. The doctor sees the reason.
- **Consent by SMS**: YES / NO / हाँ / नहीं replies, 24 h timeout, consent badges. Labs see nothing before consent.
- **DHO district map**: inline SVG (works offline), markers by utilisation, flow arrows, test and date filters, new KPIs.
- Public patient status page, printable slip with QR code, audit log page, demo clock.
- **Tests**:
  - 34 unit and database tests (`npm test`);
  - end-to-end browser rehearsals (`npm run test:e2e`);
  - GitHub Actions CI.
- **Deployment**: Dockerfile with healthcheck, `render.yaml`, `vercel.json`, `/api/health`.
- **Documentation** in `docs/`: architecture, database, API, user guide, testing, deployment. Plus SECURITY.md and CONTRIBUTING.md.
