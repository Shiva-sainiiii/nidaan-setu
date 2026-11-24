"use client";

import { useState, useTransition } from "react";
import { advanceClock, resetDemo } from "@/app/actions";

// DEMO ONLY: reset seed data and move the demo clock (to show expiry, reminders).
export function DemoControls({ offsetH }: { offsetH: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message?: string; [k: string]: unknown }>, label: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? `${label}: done` : r.message ?? "failed");
      setTimeout(() => setMsg(""), 3000);
    });
  return (
    <details className="relative">
      <summary
        aria-label={`Demo controls${offsetH ? `, demo clock plus ${offsetH} hours` : ""}`}
        className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md border border-dashed border-slate-400 px-3 text-sm text-slate-700 hover:bg-slate-50"
      >
        Demo controls{offsetH ? ` · clock +${offsetH}h` : ""}
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-56 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
        <button
          disabled={pending}
          onClick={() => confirm("Reset ALL demo data?") && run(resetDemo, "Reset")}
          className="min-h-11 w-full rounded-md bg-rose-700 px-2 font-semibold text-white disabled:opacity-50"
        >
          Reset demo data
        </button>
        <div className="flex gap-1">
          {[1, 6, 24].map((h) => (
            <button key={h} disabled={pending} onClick={() => run(() => advanceClock(h), `+${h}h`)}
              className="min-h-11 flex-1 rounded-md border border-slate-400 px-2 font-medium disabled:opacity-50">
              +{h}h
            </button>
          ))}
        </div>
        <p className="text-slate-600">Clock offset: +{offsetH}h. Advancing runs expiry, radius widening and reminders.</p>
        {msg && <p role="status" className="font-semibold text-brand-700">{msg}</p>}
      </div>
    </details>
  );
}
