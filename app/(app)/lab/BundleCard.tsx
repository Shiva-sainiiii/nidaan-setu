"use client";

import { useState, useTransition } from "react";
import { acceptBundle, acceptReferral } from "@/app/actions";
import { useIdemKey } from "@/lib/useLive";
import { relTime } from "@/lib/format";
import { Card, PriorityChip, ScoreBreakdown, TempMedBadge, btnPrimary, btnSecondary, input } from "@/components/ui";
import { tomorrow10, type Incoming } from "./IncomingCard";
import type { Toast } from "./LabDesk";

export const ONE_TRIP_BONUS = 20;

/** Several tests of one patient (one prescription) offered to this lab together. */
export function BundleCard({ items, serverNow, onResult }: { items: Incoming[]; serverNow: number; onResult: (t: Toast) => void }) {
  const first = items[0];
  const [slot, setSlot] = useState(() => tomorrow10(serverNow));
  const [pending, start] = useTransition();
  const [idem, rotateIdem] = useIdemKey();
  const allHere = items.length === first.bundle_open;
  const isNew = serverNow - new Date(first.created_at).getTime() < 15_000;

  const run = (fn: () => Promise<{ ok: boolean; message?: string; [k: string]: unknown }>, okText: (r: Record<string, unknown>) => string) =>
    start(async () => {
      try {
        const res = await fn();
        rotateIdem();
        onResult(res.ok ? { kind: "success", text: okText(res) } : { kind: "error", text: `${first.bundle_code}: ${res.message}` });
      } catch {
        onResult({ kind: "error", text: "Network problem. Press Accept again; it is safe to retry." });
      }
    });

  const acceptAll = () =>
    run(() => acceptBundle(first.bundle_id!, slot, idem), (r) => {
      const acc = (r.accepted as string[]) ?? [];
      const skipped = (r.skipped as { code: string }[]) ?? [];
      return `Accepted ${acc.join(" + ")} together (one trip). Patient notified by one SMS.` +
        (skipped.length ? ` ${skipped.length} test(s) were already taken by another lab.` : "");
    });
  const acceptOne = (it: Incoming) =>
    run(() => acceptReferral(it.id, slot, idem), () => `Accepted ${it.code} (${it.test_name}) only.`);

  return (
    <Card className={`border-2 ${allHere ? "border-emerald-300" : "border-slate-200"} ${isNew ? "flash-in" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white">BUNDLE {first.bundle_code}</span>
            <span className="text-lg font-bold">{first.bundle_size} tests for one patient</span>
            <PriorityChip p={first.priority} />
            {first.on_temp_medication && <TempMedBadge />}
            {isNew && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-white">NEW</span>}
          </div>
          {allHere ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900">
              ✅ You can do <b>all {items.length} open tests</b>: the patient needs only <b>one trip</b>.{" "}
              <span className="font-semibold">One-trip bonus +{ONE_TRIP_BONUS}</span>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
              You can do {items.length} of {first.bundle_open} open tests. The rest will go to another lab.
            </div>
          )}
          <div className="text-sm text-slate-600">
            from {first.from_name} · <b>{first.distance_km} km</b> for the patient · offer closes {relTime(first.expires_at, serverNow)}
          </div>
          {first.note && <div className="text-sm text-slate-800">“{first.note}”</div>}
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {it.test_name} <span className="text-xs font-normal text-slate-500">{it.code} · {it.is_free ? "free at your lab" : `₹${it.price_inr} at your lab`}</span>
                  </div>
                  <ScoreBreakdown score={it.score} />
                </div>
                <button className={`${btnSecondary} !py-1 text-xs`} disabled={pending} onClick={() => acceptOne(it)}>Accept only this</button>
              </li>
            ))}
          </ul>
          <div className="text-xs text-slate-500">Patient identity is shared only after you accept.</div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-64">
          <label className="text-xs text-slate-600">One slot for all (IST)
            <input type="datetime-local" className={input} value={slot} onChange={(e) => setSlot(e.target.value)} />
          </label>
          <button className={btnPrimary} disabled={pending} onClick={acceptAll}>
            {pending ? "Accepting…" : `Accept all ${items.length} here (one trip)`}
          </button>
        </div>
      </div>
    </Card>
  );
}
