"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createReferral, lookupPatientAction, previewLabsAction } from "@/app/actions";
import { useIdemKey } from "@/lib/useLive";
import { PRIORITY, fmtDT } from "@/lib/format";
import { Alert, Card, btnPrimary, btnSecondary, input } from "@/components/ui";

type Test = { id: string; name_en: string; current_wait_days: number | null };
type Lookup = Awaited<ReturnType<typeof lookupPatientAction>>;
type LabTest = { test: string; is_free: boolean; price_inr: number | null; wait: number };
type Lab = { id: string; short_name: string; kind: string; distance_km: number; n: number; tests: LabTest[] };

const DEMO_PATIENT = { phone: "9876500001", note: "Low back pain radiating to left leg for 3 weeks. Suspected disc prolapse. On analgesics." };
const CONSENT_SCRIPT =
  "I explained to the patient (in Hindi/English) that their mobile number, test names and a short note will be shared with partner labs to get earlier slots, and they agreed.";

export function NewReferralForm({ tests: allTests }: { tests: Test[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [abha, setAbha] = useState("");
  const [tests, setTests] = useState<string[]>([allTests[0]?.id ?? "MRI"]);
  const [priority, setPriority] = useState<"P1" | "P2" | "P3">("P2");
  const [tempMed, setTempMed] = useState(false);
  const [note, setNote] = useState("");
  const [maxKm, setMaxKm] = useState(25);
  const [consent, setConsent] = useState(false);
  const [waitDays, setWaitDays] = useState<number | "">("");
  const [lookup, setLookup] = useState<Lookup>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [idem, rotateIdem] = useIdemKey();

  const digits = phone.replace(/\D/g, "").slice(-10);
  const testsKey = [...tests].sort().join(",");
  const single = tests.length === 1;
  const name_of = (id: string) => allTests.find((t) => t.id === id)?.name_en ?? id;

  useEffect(() => {
    let live = true;
    const list = testsKey ? testsKey.split(",") : [];
    (digits.length === 10 && list.length ? lookupPatientAction(digits, list) : Promise.resolve(null)).then((r) => live && setLookup(r));
    return () => { live = false; };
  }, [digits, testsKey]);

  useEffect(() => {
    let live = true;
    previewLabsAction(testsKey ? testsKey.split(",") : [], maxKm).then((r) => live && setLabs(r as Lab[]));
    return () => { live = false; };
  }, [testsKey, maxKm]);

  const toggle = (id: string) => setTests((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  const slotFor = (t: string) => lookup?.slots.find((s) => s.test === t);
  const isNew = digits.length === 10 && lookup && !lookup.patient;
  const needsWait = single && digits.length === 10 && lookup && !slotFor(tests[0]);
  const oneTrip = labs.filter((l) => l.n === tests.length);
  const covered = new Set(labs.flatMap((l) => l.tests.map((t) => t.test)));
  const uncovered = tests.filter((t) => !covered.has(t));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await createReferral(
          {
            phone: digits, name, abha, tests, priority, temp_med: tempMed, note, max_km: maxKm, consent,
            wait_days: needsWait ? Number(waitDays || allTests.find((t) => t.id === tests[0])?.current_wait_days || 0) : null,
          },
          idem,
        );
        rotateIdem(); // definitive answer: a corrected resubmit must use a fresh key
        if (res.ok) router.push(`/r/${res.id}`);
        else setError(res.message ?? "Could not create referral");
      } catch {
        setError("Network problem. Press Send again; it will not create a duplicate."); // same key kept
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1. Patient</h2>
          <button type="button" className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-brand-700 underline"
            onClick={() => { setPhone(DEMO_PATIENT.phone); setNote(DEMO_PATIENT.note); setTempMed(true); setTests(["MRI"]); }}>
            Use demo patient (Ramesh Kumar)
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Mobile number (or relative&apos;s)
            <input className={input} inputMode="numeric" placeholder="10-digit mobile" value={phone}
              onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="text-sm">ABHA ID (optional)
            <input className={input} placeholder="future ABDM integration" value={abha} onChange={(e) => setAbha(e.target.value)} />
          </label>
        </div>
        {lookup?.patient && (
          <Alert kind="info">
            <b>{lookup.patient.display_name}</b>{lookup.patient.age ? `, ${lookup.patient.age}` : ""}
            <ul className="mt-1 space-y-0.5">
              {tests.map((t) => {
                const s = slotFor(t);
                const w = allTests.find((x) => x.id === t)?.current_wait_days;
                return (
                  <li key={t}>
                    {name_of(t)}:{" "}
                    {s ? <>original slot in your queue <b>{fmtDT(s.slot_at)}</b> (position {s.position}), kept as backup</>
                       : <>no slot in your queue{!single && w != null ? <> (uses your current wait, {w} days)</> : ""}</>}
                  </li>
                );
              })}
            </ul>
          </Alert>
        )}
        {(lookup?.active.length ?? 0) > 0 && (
          <Alert kind="warn">
            Already has an active referral for{" "}
            {lookup!.active.map((a, i) => (
              <span key={a.id}>{i > 0 && ", "}{name_of(a.test)} (<Link className="underline" href={`/r/${a.id}`}>{a.code}</Link>)</span>
            ))}
            . Untick it to continue.
          </Alert>
        )}
        {isNew && (
          <label className="block text-sm">New patient: name
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">2. Tests and urgency</h2>
        <div>
          <div className="mb-1 text-sm">Tests ordered <span className="text-slate-500">(tick all that apply: we try to book them together, one trip)</span></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {allTests.map((t) => (
              <label key={t.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${tests.includes(t.id) ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white"}`}>
                <input type="checkbox" checked={tests.includes(t.id)} onChange={() => toggle(t.id)} />
                <span className="font-medium">{t.name_en}</span>
                {t.current_wait_days != null && <span className="ml-auto text-xs text-slate-500">your queue: {t.current_wait_days} d</span>}
              </label>
            ))}
          </div>
          {tests.length > 1 && (
            <p className="mt-1 text-xs text-brand-800">{tests.length} tests → one bundle for this patient. One SMS; labs that can do all of them are shown first.</p>
          )}
        </div>
        {needsWait && (
          <label className="block max-w-xs text-sm">Current wait at your hospital (days)
            <input className={input} type="number" min={1} max={120}
              placeholder={String(allTests.find((t) => t.id === tests[0])?.current_wait_days ?? "")}
              value={waitDays} onChange={(e) => setWaitDays(e.target.value ? Number(e.target.value) : "")} />
          </label>
        )}
        <div>
          <div className="mb-1 text-sm">Priority (set by doctor, visible to every lab, audited)</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["P1", "P2", "P3"] as const).map((p) => (
              <button type="button" key={p} onClick={() => setPriority(p)}
                className={`rounded-lg border p-2 text-left text-sm ${priority === p ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/30" : "border-slate-300 bg-white"}`}>
                <div className="font-semibold">{PRIORITY[p].label}</div>
                <div className="text-xs text-slate-500">{PRIORITY[p].desc}</div>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tempMed} onChange={(e) => setTempMed(e.target.checked)} />
          Patient is on <b>temporary medication</b> (e.g. painkillers) while waiting for these tests
        </label>
        <label className="block text-sm">Short clinical note for the lab ({280 - note.length} left)
          <textarea className={input} rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Region / indication. No more than the lab needs." />
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">3. Where to look</h2>
        <label className="block text-sm">Maximum travel distance: <b>{maxKm} km</b>
          <input type="range" min={5} max={60} step={5} value={maxKm} onChange={(e) => setMaxKm(Number(e.target.value))} className="w-full accent-brand-700" />
        </label>
        <div className="text-sm">
          <b>{labs.length}</b> partner lab{labs.length === 1 ? "" : "s"} within {maxKm} km
          {tests.length > 1 && <> · <b className="text-emerald-700">{oneTrip.length}</b> can do all {tests.length} tests in one trip</>}:
          <ul className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {labs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                <span>
                  {l.short_name}
                  {tests.length > 1 && l.n === tests.length && (
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">all {l.n} tests, one trip</span>
                  )}
                </span>
                <span className="text-slate-500">
                  {l.distance_km} km · {l.tests.map((t) => `${t.test} ${t.is_free ? "free" : `₹${t.price_inr}`} ~${t.wait}d`).join(" · ")}
                </span>
              </li>
            ))}
            {labs.length === 0 && <li className="px-3 py-2 text-slate-500">None: widen the distance.</li>}
          </ul>
          {uncovered.length > 0 && labs.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">No lab within {maxKm} km offers {uncovered.map(name_of).join(", ")}. Widen the distance or untick it.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">4. Consent</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{CONSENT_SCRIPT} <span className="text-slate-500">(recorded in the audit log)</span></span>
        </label>
      </Card>

      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={pending || !consent || tests.length === 0 || labs.length === 0 || uncovered.length > 0}>
          {pending ? "Sending…" : tests.length > 1 ? `Send ${tests.length} tests to ${labs.length} labs` : `Send to ${labs.length} lab${labs.length === 1 ? "" : "s"}`}
        </button>
        <Link href="/doctor" className={btnSecondary}>Cancel</Link>
      </div>
    </form>
  );
}
