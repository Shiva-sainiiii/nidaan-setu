"use client";

import Link from "next/link";
import { useState } from "react";
import { useLive } from "@/lib/useLive";
import { fmtDT } from "@/lib/format";
import { Card, PriorityChip, Stat, StatusChip } from "@/components/ui";
import { LiveBadge } from "@/components/LiveBadge";
import { DistrictMap, type MapFlow, type MapHospital } from "@/components/DistrictMap";

type Data = {
  kpi: {
    sent: number; accepted: number; tests_done: number; median_days_saved: number; total_days_saved: number;
    slots_released: number; expired: number; temp_med_waiting_14d: number; bundles: number; trips_saved: number;
    avg_days_saved: number; no_shows: number; bookings: number; sms_consent: number; sms_granted: number;
  };
  hospitals: MapHospital[];
  flows: MapFlow[];
  tests: { id: string; name_en: string; name_hi: string }[];
  doctors: { name: string; short_name: string; referrals: number; p1: number; temp_med: number }[];
  waiting: { code: string; test: string; from_name: string; priority: string; status: string; created_at: string; expected_at: string }[];
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const bestLab = (hs: MapHospital[]) => {
  const labs = hs.filter((h) => h.received > 0).sort((a, b) => b.accepted / b.received - a.accepted / a.received);
  return labs[0] ? `${labs[0].short_name.replace(/ \(.\)$/, "")} ${pct(labs[0].accepted, labs[0].received)}` : "—";
};

const RANGES: { days: number | null; en: string; hi: string }[] = [
  { days: 1, en: "Today", hi: "आज" }, { days: 7, en: "7 days", hi: "7 दिन" },
  { days: 30, en: "30 days", hi: "30 दिन" }, { days: null, en: "All", hi: "सब" },
];

function Seg<T extends string | number | null>({ label, value, options, onChange }: {
  label: string; value: T; options: { v: T; en: string; hi?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white/80 p-1 shadow-sm">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${value === o.v ? "bg-brand-700 text-white shadow" : "text-slate-700 hover:bg-brand-50"}`}>
          {o.en}{o.hi && <span lang="hi" className={`ml-1 text-xs font-normal ${value === o.v ? "text-brand-100" : "text-slate-500"}`}>{o.hi}</span>}
        </button>
      ))}
    </div>
  );
}

export function DhoView() {
  const [test, setTest] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const qs = `${test ? `&test=${test}` : ""}${days ? `&days=${days}` : ""}`;
  const { data, stale } = useLive<Data>(`/api/live?view=dho${qs}`, 4000);
  const k = data?.kpi;
  const testName = test ? data?.tests.find((t) => t.id === test)?.name_en ?? test : "All tests";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">District dashboard</h1>
          <p className="text-sm text-slate-500">Demo District · all numbers are computed live from referral records (synthetic data) <span lang="hi">· ज़िला डैशबोर्ड</span></p>
        </div>
        <LiveBadge stale={stale} />
      </div>

      <div className="flex flex-wrap items-center gap-3" aria-label="Filters">
        <Seg label="Test type" value={test}
          options={[{ v: null, en: "All tests", hi: "सभी" }, ...(data?.tests ?? []).map((t) => ({ v: t.id, en: t.id, hi: t.name_hi }))]}
          onChange={setTest} />
        <Seg label="Date range" value={days} options={RANGES.map((r) => ({ v: r.days, en: r.en, hi: r.hi }))} onChange={setDays} />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">District map <span lang="hi" className="font-normal text-slate-500">/ ज़िले का नक्शा</span></h2>
          <span className="text-xs text-slate-500">{testName} · {RANGES.find((r) => r.days === days)?.en} · drawn from facility coordinates (works offline)</span>
        </div>
        {data ? <DistrictMap hospitals={data.hospitals} flows={data.flows} testLabel={testName} /> : <div className="h-72 animate-pulse rounded-xl bg-slate-100" />}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Referrals sent" value={k?.sent ?? "…"} icon="send" />
        <Stat label="Accepted by a lab" value={k ? `${k.accepted} (${pct(k.accepted, k.sent)})` : "…"} icon="checkCircle" accent="green" />
        <Stat label="Tests done earlier" value={k?.tests_done ?? "…"} icon="flask" accent="green" />
        <Stat label="Median days saved" value={k ? k.median_days_saved : "…"} hint={k ? `${k.total_days_saved} patient-days in total` : ""} icon="clock" accent="saffron" />
        <Stat label="Queue slots released" value={k?.slots_released ?? "…"} hint="given to the next patient at the sending hospital" icon="users" accent="green" />
        <Stat label="Expired (no lab)" value={k?.expired ?? "…"} hint="patient kept original date" icon="x" accent="rose" />
        <Stat label="On temp. medication, >14 days to test" value={k?.temp_med_waiting_14d ?? "…"} hint="needs attention" icon="alert" accent="amber" />
        <Stat label="Patient trips saved" value={k?.trips_saved ?? "…"} hint={k ? `by booking ${k.bundles} multi-test bundle(s) together` : ""} icon="route" accent="saffron" />
        <Stat label="Average days saved" value={k ? k.avg_days_saved : "…"} hint="per test done earlier" icon="calendar" accent="green" />
        <Stat label="No-show rate" value={k ? pct(k.no_shows, k.bookings) : "…"} hint={k ? `${k.no_shows} no-show(s) of ${k.bookings} bookings` : ""} icon="users" accent="rose" />
        <Stat label="Consent by SMS" value={k ? `${k.sms_granted} / ${k.sms_consent}` : "…"} hint="patients who replied YES / asked" icon="message" accent="brand" />
        <Stat label="Best lab acceptance" value={data ? bestLab(data.hospitals) : "…"} hint="accepted ÷ requests received (labs)" icon="flask" accent="green" />
      </div>

      <Card className="overflow-x-auto !p-0">
        <div className="border-b border-slate-100 px-4 py-2 font-semibold">Facilities</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Facility</th><th className="px-3 py-2">Referrals sent</th><th className="px-3 py-2">Requests received</th>
              <th className="px-3 py-2">Accepted (rate)</th><th className="px-3 py-2">Declined</th><th className="px-3 py-2">Tests done for others</th>
              <th className="px-3 py-2">Avg. wait (d)</th>
            </tr>
          </thead>
          <tbody>
            {data?.hospitals.map((h) => (
              <tr key={h.id} className="border-t border-slate-100 transition-colors hover:bg-brand-50/60">
                <td className="px-3 py-1.5 font-medium">{h.short_name} <span className="text-xs text-slate-500">{h.kind === "ppp" ? "PPP" : "Govt"}</span></td>
                <td className="px-3 py-1.5">{h.sent}</td>
                <td className="px-3 py-1.5">{h.received}</td>
                <td className="px-3 py-1.5">{h.accepted} <span className="text-xs text-slate-500">{pct(h.accepted, h.received)}</span></td>
                <td className="px-3 py-1.5">{h.declined}</td>
                <td className="px-3 py-1.5">{h.tests_done}</td>
                <td className="px-3 py-1.5">{h.offers_test ? h.wait_days ?? "—" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="!p-0">
          <div className="border-b border-slate-100 px-4 py-2 font-semibold">Priority use by doctor <span className="text-xs font-normal text-slate-500">(spot queue-jumping)</span></div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Doctor</th><th className="px-3 py-2">Referrals</th><th className="px-3 py-2">P1 share</th><th className="px-3 py-2">Temp. med flag</th></tr>
            </thead>
            <tbody>
              {data?.doctors.map((d) => (
                <tr key={d.name} className="border-t border-slate-100 transition-colors hover:bg-brand-50/60">
                  <td className="px-3 py-1.5">{d.name}<div className="text-xs text-slate-500">{d.short_name}</div></td>
                  <td className="px-3 py-1.5">{d.referrals}</td>
                  <td className="px-3 py-1.5">{pct(d.p1, d.referrals)}</td>
                  <td className="px-3 py-1.5">{pct(d.temp_med, d.referrals)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="!p-0">
          <div className="border-b border-slate-100 px-4 py-2 font-semibold">On temporary medication, test more than 14 days away</div>
          <ul className="divide-y divide-slate-100 text-sm">
            {data?.waiting.length === 0 && <li className="px-4 py-6 text-center text-slate-500">None right now.</li>}
            {data?.waiting.map((w) => (
              <li key={w.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span><b>{w.code}</b> {w.test} · {w.from_name} · <PriorityChip p={w.priority} /></span>
                <span className="flex items-center gap-2 text-xs text-slate-600">expected {fmtDT(w.expected_at)} <StatusChip status={w.status} /></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="text-xs text-slate-500">DHO sees counts, not patient details. <Link className="underline" href="/audit">Open audit log</Link></p>
    </div>
  );
}
