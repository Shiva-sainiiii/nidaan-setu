// Applies db/schema.sql + db/seed.sql (and db/supabase-realtime.sql on Supabase).
// Usage: npm run db:setup   (reads DATABASE_URL from .env.local or env)
import fs from "node:fs";
import pg from "pg";

for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set (see .env.example)"); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
await client.connect();
const files = ["db/schema.sql", "db/seed.sql"];
const isSupabase = (await client.query("select exists(select 1 from pg_publication where pubname='supabase_realtime') as s")).rows[0].s;
if (isSupabase) files.push("db/supabase-realtime.sql");
for (const f of files) {
  process.stdout.write(`Applying ${f} ... `);
  await client.query(fs.readFileSync(f, "utf8"));
  console.log("ok");
}
await client.end();
console.log(isSupabase ? "Done (Supabase realtime enabled)." : "Done (plain Postgres: the app uses 2s polling).");
