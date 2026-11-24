import Link from "next/link";
import { loginAs } from "@/app/actions";
import { FlowDiagram } from "@/components/FlowDiagram";
import { Icon, type IconName } from "@/components/Icon";
import { dbStatus, q } from "@/lib/db";

type Row = { id: string; name: string; role: string; hospital_id: string | null; hospital: string | null; kind: string | null };

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "send", title: "Doctor sends the test", text: "Not the patient. Treatment stays with the same doctor." },
  { icon: "flask", title: "One nearby lab accepts", text: "Labs with free slots race; the database lets exactly one win." },
  { icon: "message", title: "Patient gets an SMS", text: "Hindi + English, a printed slip with QR. No app needed." },
  { icon: "file", title: "Report comes back", text: "And the original queue slot goes to the next patient." },
];

const TRUST: { icon: IconName; text: string }[] = [
  { icon: "shield", text: "Exactly one booking, guaranteed by the database" },
  { icon: "list", text: "Every action and every data view is audited" },
  { icon: "users", text: "Patient identity shared only after a lab accepts" },
  { icon: "smartphone", text: "Works in any browser; patients need only SMS" },
];

const ROLE_STYLE: Record<string, { icon: IconName; tile: string; tag: string }> = {
  doctor: { icon: "stethoscope", tile: "bg-brand-700 text-white", tag: "Referring hospital" },
  lab: { icon: "flask", tile: "bg-emerald-600 text-white", tag: "Partner lab" },
  dho: { icon: "chart", tile: "bg-india-saffron text-white", tag: "District" },
};

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
    <div className="space-y-12">
      {/* ------------------------------------------------ hero */}
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-semibold text-brand-800">
            <span className="h-1.5 w-1.5 rounded-full bg-india-saffron" /> District diagnostic referral network
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl">
            Nidaan Setu <span lang="hi" className="block text-3xl font-semibold text-brand-600 sm:text-4xl">निदान सेतु</span>
          </h1>
          <p className="text-xl font-semibold text-slate-900">
            Your doctor stays the same. <span className="text-brand-700">Only the test moves</span>, to wherever it can be done fastest.
          </p>
          <p lang="hi" className="text-lg text-slate-700">आपका डॉक्टर वही रहेगा। सिर्फ़ जाँच वहाँ होगी जहाँ सबसे जल्दी हो सके।</p>
          <p className="max-w-xl text-slate-600">
            Government hospital queues for MRI, CT or ECHO can run for weeks while patients wait on painkillers.
            Nidaan Setu sends just the test to a nearby lab with a free slot, and frees the original slot for the next patient.
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={loginAs}>
              <input type="hidden" name="id" value="doc-a" />
              <button className="btn-shine group inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-600 to-brand-800 px-5 text-base font-semibold text-white shadow-lg shadow-brand-900/25 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0">
                Start the demo as the doctor <Icon name="arrowRight" size={18} className="nudge" />
              </button>
            </form>
            <a href="#roles" className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white/90 px-5 text-base font-semibold text-slate-800 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50">
              Choose a role
            </a>
          </div>
        </div>
        <div className="surface float p-4 sm:p-6">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>How one referral flows</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              live demo
            </span>
          </div>
          <FlowDiagram />
        </div>
      </section>

      {/* ------------------------------------------------ how it works */}
      <section aria-labelledby="how">
        <h2 id="how" className="mb-4 text-lg font-bold text-slate-900">How it works</h2>
        <ol className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="surface lift relative p-5">
              <span className="absolute right-4 top-3 text-4xl font-extrabold text-slate-100">{i + 1}</span>
              <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={s.icon} size={22} />
              </span>
              <h3 className="relative mt-3 font-semibold text-slate-900">{s.title}</h3>
              <p className="relative mt-1 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------ roles */}
      <section id="roles" aria-labelledby="roles-h" className="scroll-mt-28 space-y-6">
        <div>
          <h2 id="roles-h" className="text-lg font-bold text-slate-900">Open a desk</h2>
          <p className="text-sm text-slate-600">Demo logins, no password. Use a private window for a second role on the same laptop.</p>
        </div>
        {groups.map(([title, sub, rows]) => (
          <div key={title}>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="mb-3 text-sm text-slate-600">{sub}</p>
            <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((u) => {
                const st = ROLE_STYLE[u.role] ?? ROLE_STYLE.doctor;
                return (
                  <form key={u.id} action={loginAs}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="surface lift group flex w-full items-center gap-3 p-4 text-left">
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105 ${st.tile}`}>
                        <Icon name={st.icon} size={24} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">{u.name}</span>
                        <span className="block truncate text-sm text-slate-600">
                          {u.hospital ?? "Demo District"}
                          {u.hospital_id ? ` (${u.hospital_id})` : ""}
                        </span>
                        <span className="mt-1 inline-flex gap-1.5 text-xs">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{st.tag}</span>
                          {u.kind && (
                            <span className={`rounded px-1.5 py-0.5 ${u.kind === "ppp" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                              {u.kind === "ppp" ? "PPP · paid" : u.role === "lab" ? "Govt · free" : "Govt"}
                            </span>
                          )}
                        </span>
                      </span>
                      <Icon name="arrowRight" size={18} className="nudge text-slate-400 group-hover:text-brand-700" />
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <h3 className="font-semibold text-slate-900">No login needed</h3>
          <div className="stagger mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { href: "/phone", icon: "smartphone" as IconName, t: "Patient phone (simulated SMS)", s: "What the patient receives, in Hindi and English" },
              { href: "/audit", icon: "shield" as IconName, t: "Audit log", s: "Every action, append-only" },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="surface lift group flex items-center gap-3 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-800 text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <Icon name={c.icon} size={24} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-slate-900">{c.t}</span>
                  <span className="block text-sm text-slate-600">{c.s}</span>
                </span>
                <Icon name="arrowRight" size={18} className="nudge text-slate-400 group-hover:text-brand-700" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ trust */}
      <section aria-labelledby="trust" className="rounded-2xl bg-brand-900 p-6 text-white sm:p-8">
        <h2 id="trust" className="text-lg font-bold">Built to be trusted</h2>
        <ul className="stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <li key={t.text} className="flex items-start gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition-colors hover:bg-white/10">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-india-saffron">
                <Icon name={t.icon} size={18} />
              </span>
              <span className="text-sm text-brand-50">{t.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DbProblem({ error, mode, host, notes }: { error: string; mode: string; host: string | null; notes: string[] }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-rose-300 bg-rose-50 p-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-rose-900"><Icon name="alert" /> Database not connected</h1>
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
