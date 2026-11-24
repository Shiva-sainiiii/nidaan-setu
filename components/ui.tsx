import type { ReactNode } from "react";
import { CountUp } from "./CountUp";
import { Icon, type IconName } from "./Icon";
import { CONSENT, PRIORITY, STATUS, type Status } from "@/lib/format";

export function StatusChip({ status, lang = "en" }: { status: string; lang?: "en" | "hi" }) {
  const s = STATUS[status as Status] ?? { en: status, hi: status, cls: "bg-slate-100 text-slate-700 ring-slate-300" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>
      {lang === "hi" ? s.hi : s.en}
    </span>
  );
}

export function ConsentChip({ status }: { status: string }) {
  const c = CONSENT[status] ?? CONSENT.verbal;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${c.cls}`} title={c.hi}>{c.en}</span>;
}

export function PriorityChip({ p }: { p: string }) {
  const m = PRIORITY[p];
  return (
    <span title={m?.desc} className={`inline-flex rounded px-1.5 py-0.5 text-xs font-bold ${m?.cls ?? "bg-slate-400 text-white"}`}>
      {m?.label ?? p}
    </span>
  );
}

export function TempMedBadge() {
  return (
    <span className="inline-flex rounded bg-fuchsia-100 px-1.5 py-0.5 text-xs font-semibold text-fuchsia-900 ring-1 ring-fuchsia-300">
      On temporary medication
    </span>
  );
}

/** White surface with a soft shadow that deepens on hover. `interactive` also lifts (for clickable cards). */
export function Card({ children, className = "", interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <div className={`surface p-4 ${interactive ? "lift" : ""} ${className}`}>{children}</div>;
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  const cls = {
    info: "bg-sky-50 text-sky-900 border-sky-200",
    error: "bg-rose-50 text-rose-900 border-rose-300",
    success: "bg-emerald-50 text-emerald-900 border-emerald-300",
    warn: "bg-amber-50 text-amber-900 border-amber-300",
  }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`toast-in rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export type Score = { total: number; parts: { label: string; pts: number }[] };

export function ScoreBreakdown({ score }: { score: Score }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">Score {score.total}</span>
      <span>=</span>
      {score.parts.map((p, i) => (
        <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5">
          {p.label} <b className={p.pts >= 0 ? "text-emerald-700" : "text-rose-700"}>{p.pts >= 0 ? `+${p.pts}` : p.pts}</b>
        </span>
      ))}
    </div>
  );
}

const ACCENT = {
  brand: { bar: "bg-brand-600", icon: "bg-brand-50 text-brand-700" },
  green: { bar: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-700" },
  amber: { bar: "bg-amber-500", icon: "bg-amber-50 text-amber-700" },
  rose: { bar: "bg-rose-500", icon: "bg-rose-50 text-rose-700" },
  saffron: { bar: "bg-india-saffron", icon: "bg-orange-50 text-orange-700" },
} as const;

/** KPI tile: accent bar, optional icon, numbers count up when they change. */
export function Stat({ label, value, hint, icon, accent = "brand" }: {
  label: string; value: ReactNode; hint?: string; icon?: IconName; accent?: keyof typeof ACCENT;
}) {
  const a = ACCENT[accent];
  return (
    <div className="surface relative overflow-hidden p-4">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</div>
        {icon && (
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${a.icon}`}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-600">{hint}</div>}
    </div>
  );
}

// 44px minimum touch target on every control (WCAG 2.5.5); visible focus ring comes from globals.css.
export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const btnPrimary = `${btn} btn-shine bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm shadow-brand-900/20 hover:shadow-md hover:shadow-brand-900/25 hover:from-brand-500 hover:to-brand-700`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-900 shadow-sm hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800`;
export const btnDanger = `${btn} border border-rose-300 bg-white text-rose-800 hover:border-rose-400 hover:bg-rose-50`;
export const input =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15";
