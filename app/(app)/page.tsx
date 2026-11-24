import Link from "next/link";
import { loginAs } from "@/app/actions";
import { dbStatus, q } from "@/lib/db";

type Row = { id: string; name: string; role: string; hospital_id: string | null; hospital: string | null; kind: string | null };

export default async function LoginPage() {
  const status = await dbStatus();
  if (!status.ok) return <DbProblem error={status.error} mode={status.mode} host={status.host} notes={status.urlNotes} />;
  const users = await q<Row>(
    `select u.id, u.name, u.role, u.hospital_id, h.name as hospital, h.kind
       from tb.demo_users u left join tb.hospitals h on h.id = u.hospital_id order by u.role = 'doctor' desc, u.role, u.id`,
  );
  const groups: [string, string, Row[]][] = [
    ["Referring doctor", "Creates test referrals and receives reports", users.filter((u) => u.role === "doctor")],
    ["Partner lab desks", "Accept requests, mark arrived and done, upload reports", users.filter((u) => u.role === "lab")],
    ["District", "Network-level view", users.filter((u) => u.role === "dho")],
  ];
  return (
    <div className="space-y-8">
      <section className="rounded-lg border-l-8 border-india-saffron bg-brand-800 p-6 text-white">
        <h1 className="text-3xl font-bold">Nidaan Setu <span className="font-normal text-brand-100">· निदान सेतु</span></h1>
        <p className="text-sm text-brand-100">A bridge to faster diagnosis (निदान = diagnosis, सेतु = bridge)</p>
        <p className="mt-1 text-lg text-brand-50">Your doctor stays the same. Only the test moves, to wherever it can be done fastest.</p>
        <p lang="hi" className="mt-1 text-brand-100">आपका डॉक्टर वही रहेगा। सिर्फ़ जाँच वहाँ होगी जहाँ सबसे जल्दी हो सके।</p>
      </section>

      {groups.map(([title, sub, rows]) => (
        <section key={title}>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mb-3 text-sm text-slate-500">{sub}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((u) => (
              <form key={u.id} action={loginAs}>
                <input type="hidden" name="id" value={u.id} />
                <button className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-500 hover:shadow">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-sm text-slate-500">
                    {u.hospital ?? "Demo District"}
                    {u.hospital_id ? ` (${u.hospital_id})` : ""}
                    {u.kind === "ppp" ? " · PPP, paid" : u.kind ? " · Govt" : ""}
                  </div>
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 className="text-lg font-semibold">No login needed</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/phone" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
            <div className="font-semibold">Patient phone (simulated SMS)</div>
            <div className="text-sm text-slate-500">What the patient receives, in Hindi and English</div>
          </Link>
          <Link href="/audit" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
            <div className="font-semibold">Audit log</div>
            <div className="text-sm text-slate-500">Every action, append-only</div>
          </Link>
        </div>
      </section>
    </div>
  );
}

function DbProblem({ error, mode, host, notes }: { error: string; mode: string; host: string | null; notes: string[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-rose-300 bg-rose-50 p-6">
      <h1 className="text-xl font-bold text-rose-900">Database not connected</h1>
      <p className="text-rose-900">{error}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-rose-900">
        <li>Mode: <b>{mode === "postgres" ? "Postgres / Supabase (DATABASE_URL is set)" : "built-in local database (DATABASE_URL empty)"}</b>{host && <> · host <code>{host}</code></>}</li>
        {notes.map((n) => <li key={n}>{n}</li>)}
        <li>After changing environment variables on Vercel you must <b>Redeploy</b>.</li>
        <li>Details: <a className="underline" href="/api/health">/api/health</a></li>
      </ul>
    </div>
  );
}
