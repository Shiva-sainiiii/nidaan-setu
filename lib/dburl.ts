// Validates / repairs DATABASE_URL and turns common mistakes into clear messages.
// Pure function (no server-only import) so it can be unit-tested with plain node.

export type DbUrlResult =
  | { ok: true; url: string; notes: string[]; host: string; user: string }
  | { ok: false; error: string };

const HOW =
  "Supabase → Connect (top bar) → “Transaction pooler” → copy the URI " +
  "(postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres)";

/** Returns null when DATABASE_URL is empty (→ built-in local database). */
export function normalizeDatabaseUrl(raw: string | null | undefined): DbUrlResult | null {
  let s = (raw ?? "").trim();
  s = s.replace(/^DATABASE_URL\s*=\s*/i, "").trim(); // pasted "DATABASE_URL=..." into the value box
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim(); // pasted with quotes
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) {
    return {
      ok: false,
      error: `DATABASE_URL is an https:// address (probably the Supabase Project URL). It must be the Postgres connection string. ${HOW}`,
    };
  }
  const scheme = s.match(/^postgres(?:ql)?:\/\//i)?.[0];
  if (!scheme) {
    return { ok: false, error: `DATABASE_URL must start with postgresql:// . ${HOW}` };
  }
  if (/YOUR[-_ ]?PASSWORD/i.test(s)) {
    return { ok: false, error: "DATABASE_URL still contains the placeholder [YOUR-PASSWORD]. Replace it with your database password (no square brackets)." };
  }

  const rest = s.slice(scheme.length);
  const slash = rest.indexOf("/", rest.lastIndexOf("@") + 1);
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  const tail = slash === -1 ? "" : rest.slice(slash);
  const at = authority.lastIndexOf("@"); // last @ separates password from host, so @ inside the password is fine
  if (at === -1) return { ok: false, error: `DATABASE_URL has no user:password@ part. ${HOW}` };

  const creds = authority.slice(0, at);
  const hostPort = authority.slice(at + 1);
  const colon = creds.indexOf(":");
  if (colon === -1) return { ok: false, error: "DATABASE_URL has no password (expected user:password@host)." };
  const user = creds.slice(0, colon);
  let pass = creds.slice(colon + 1);
  const notes: string[] = [];

  if (/^\[.*\]$/.test(pass)) {
    pass = pass.slice(1, -1);
    notes.push("removed [ ] around the password");
  }
  let decoded = pass;
  try {
    decoded = decodeURIComponent(pass);
  } catch {
    /* raw % in password: treat as literal */
  }
  const encPass = encodeURIComponent(decoded);
  if (encPass !== pass) notes.push("URL-encoded special characters in the password");
  const encUser = encodeURIComponent(safeDecode(user));

  const url = `${scheme}${encUser}:${encPass}@${hostPort}${tail}`;
  try {
    const u = new URL(url);
    if (!u.hostname) throw new Error("no host");
  } catch {
    return { ok: false, error: `DATABASE_URL host/port/database part is not valid ("${hostPort}${tail}"). ${HOW}` };
  }

  if (/^db\.[a-z0-9]+\.supabase\.co(:5432)?$/i.test(hostPort)) {
    notes.push("this is Supabase's Direct connection (IPv6 only); if it fails, use the Transaction pooler URI");
  }
  if (/pooler\.supabase\.com/i.test(hostPort) && !/^postgres\.[a-z0-9]+$/i.test(safeDecode(user))) {
    notes.push("pooler user should look like postgres.<project-ref>");
  }
  return { ok: true, url, notes, host: hostPort, user: safeDecode(user) };
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Turns raw driver errors into actionable messages. */
export function explainDbError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code ?? "";
  if (/password authentication failed/i.test(msg)) return "Database password is wrong. Check the password in DATABASE_URL (Supabase → Project Settings → Database → reset password if unsure).";
  if (/Tenant or user not found/i.test(msg)) return "Supabase pooler says 'Tenant or user not found': the user must be postgres.<project-ref> and the region host must match your project. Copy the URI again from Supabase → Connect → Transaction pooler.";
  if (code === "ENOTFOUND" || /getaddrinfo/i.test(msg)) return "Database host not found. Check the host part of DATABASE_URL.";
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") return "Database not reachable (often the IPv6-only Direct connection). Use the Supabase Transaction pooler URI.";
  if (code === "ECONNREFUSED") return "Database refused the connection (wrong port, or the server is not running).";
  if (/timeout/i.test(msg)) return "Timed out connecting to the database. Check host/port, or that the Supabase project is not paused.";
  return msg;
}
