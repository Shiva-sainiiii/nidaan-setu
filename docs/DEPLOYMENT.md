# Deployment

| Option | Database | Best for |
|---|---|---|
| Docker | built-in (volume), or `DATABASE_URL` | any server or laptop |
| Render (`render.yaml`) | built-in on a persistent disk | one-click hosted demo |
| Vercel + Supabase (`vercel.json`) | Supabase Postgres | serverless, Mumbai region |
| LAN (`npm run start:lan`) | built-in | venue without internet |

Requirements: Node ≥ 22.18 (Docker image: `node:22-slim`). Every deployment exposes **`GET /api/health`**.

## Environment variables (see [.env.example](../.env.example))

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | no | Empty: built-in PGlite in `./.data`. Set: Postgres URI (Supabase **Transaction pooler**, port 6543). Special characters in the password are encoded automatically. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Instant refresh via Supabase Realtime. Without them, screens poll every 2 s. |
| `PORT` | no | Listening port (default 3000). |

The schema and demo data are **created automatically** on first start, and upgraded when `SCHEMA_VERSION` changes. Never commit real `.env*` files.

## Docker
```bash
docker build -t nidaan-setu .
docker run -d --name nidaan-setu -p 3000:3000 -v nidaan-data:/app/.data nidaan-setu
curl localhost:3000/api/health          # {"ok":true,"mode":"pglite",...}
```
- The image runs as the non-root `node` user and has a `HEALTHCHECK`.
- To use Postgres, add `-e DATABASE_URL=postgresql://…`.
- Run **one** container when using the built-in database.

## Render
*New → Blueprint* and select the repo. [`render.yaml`](../render.yaml) sets the build and start commands, `/api/health` as the health check, one instance and a 1 GB disk for `./.data`.

## Vercel + Supabase
1. Supabase (region Mumbai) → **Connect** → **Transaction pooler** → copy the `postgresql://…:6543/postgres` URI.
2. Vercel → import the repo ([`vercel.json`](../vercel.json) pins region `bom1`) → set `DATABASE_URL` for Production → deploy.
3. Open `/api/health`. The first request creates the tables and demo data in Supabase.

## Offline / LAN
```bash
npm run start:lan          # build + serve on 0.0.0.0:3000
hostname -I                # other devices on the same hotspot open http://<ip>:3000
```
Build once while you still have internet (fonts are fetched at build time).

## Before a demo
Run `npm run test:e2e` against the deployment (`BASE=https://… npm run test:e2e`). It ends with **Reset demo data**, so the app starts clean.
