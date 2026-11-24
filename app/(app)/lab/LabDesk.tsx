"use client";

import { useEffect, useRef, useState } from "react";
import { useLive } from "@/lib/useLive";
import { fmtDT } from "@/lib/format";
import { Alert, StatusChip } from "@/components/ui";
import { LiveBadge } from "@/components/LiveBadge";
import { IncomingCard, type Incoming } from "./IncomingCard";
import { BundleCard, ONE_TRIP_BONUS } from "./BundleCard";
import { TodayCard, type Today } from "./TodayCard";
import { Icon } from "@/components/Icon";

type Missed = { id: number; code: string; test_type_id: string; priority: string; status: string; response: string | null; winner: string | null; updated_at: string };
type Done = { id: number; code: string; test_type_id: string; status: string; accepted_slot_at: string; from_name: string; uploaded_at: string | null };
type Data = { incoming: Incoming[]; missed: Missed[]; today: Today[]; done: Done[] };
export type Toast = { kind: "success" | "error" | "info"; text: string };

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio blocked until first click: fine */
  }
}

/** Groups tests of the same bundle; a lab that can do every open test gets a one-trip bonus in the ordering. */
function groupIncoming(rows: Incoming[]): Incoming[][] {
  const groups = new Map<string, Incoming[]>();
  for (const r of rows) {
    const k = r.bundle_id ? `b${r.bundle_id}` : `r${r.id}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const rank = (g: Incoming[]) =>
    Math.max(...g.map((r) => r.score.total)) + (g.length > 1 && g.length === g[0].bundle_open ? ONE_TRIP_BONUS : 0);
  return [...groups.values()].sort((a, b) => rank(b) - rank(a));
}

export function LabDesk({ hospital }: { hospital: string }) {
  const { data, stale, error, refresh, now } = useLive<Data>("/api/live?view=lab");
  const [tab, setTab] = useState<"incoming" | "today" | "done">("incoming");
  const [toast, setToast] = useState<Toast | null>(null);
  const seen = useRef<Set<number> | null>(null);
  const serverNow = now ? new Date(now).getTime() : 0; // data and now always arrive together

  // Sound when a new request arrives (not on first load).
  useEffect(() => {
    if (!data) return;
    const ids = data.incoming.map((r) => r.id);
    if (seen.current && ids.some((id) => !seen.current!.has(id))) beep();
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [data]);

  const notify = (t: Toast) => {
    setToast(t);
    refresh();
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 7000);
  };

  const tabs = [
    { id: "incoming", label: "Incoming requests", n: data?.incoming.length },
    { id: "today", label: "Booked / today", n: data?.today.length },
    { id: "done", label: "Done", n: data?.done.length },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lab desk</h1>
          <p className="text-sm text-slate-500">{hospital} · test requests from nearby hospitals</p>
        </div>
        <LiveBadge stale={stale} />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {toast && <div className="sticky top-24 z-10"><Alert kind={toast.kind}>{toast.text}</Alert></div>}

      <div role="tablist" aria-label="Lab desk sections" className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white/70 p-1 shadow-sm backdrop-blur">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-200 ${
              tab === t.id ? "bg-brand-700 text-white shadow-md shadow-brand-900/20" : "text-slate-700 hover:bg-brand-50 hover:text-brand-800"}`}>
            <Icon name={t.id === "incoming" ? "inbox" : t.id === "today" ? "calendar" : "checkCircle"} size={17} />
            {t.label}
            {t.n != null && (
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                t.id === "incoming" && t.n > 0 ? "animate-pulse bg-amber-400 text-amber-950" : tab === t.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>{t.n}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "incoming" && (
        <div className="space-y-3">
          {data?.incoming.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-600">
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon name="inbox" size={24} /></span>
              No open requests right now. New ones appear here instantly.
            </div>
          )}
          {groupIncoming(data?.incoming ?? []).map((g) =>
            g.length > 1 ? (
              <BundleCard key={`b${g[0].bundle_id}`} items={g} serverNow={serverNow} onResult={notify} />
            ) : (
              <IncomingCard key={g[0].id} r={g[0]} serverNow={serverNow} onResult={notify} />
            ),
          )}
          {(data?.missed.length ?? 0) > 0 && (
            <div className="pt-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recently closed for your lab</h3>
              <ul className="space-y-1">
                {data!.missed.map((m) => (
                  <li key={`${m.id}-${m.status}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <b>{m.code}</b> {m.test_type_id} ·
                    {m.response === "declined" ? " You declined" :
                      m.winner ? <span className="font-semibold text-rose-700">Already accepted by {m.winner}</span> :
                      <StatusChip status={m.status} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "today" && (
        <div className="space-y-3">
          {data?.today.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No booked patients.</p>}
          {data?.today.map((r) => <TodayCard key={r.id} r={r} onResult={notify} />)}
        </div>
      )}

      {tab === "done" && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {data?.done.length === 0 && <li className="p-6 text-center text-slate-500">Nothing completed yet.</li>}
          {data?.done.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span><b>{d.code}</b> · {d.test_type_id} · from {d.from_name} · {fmtDT(d.accepted_slot_at)}</span>
              <span className="flex items-center gap-2">
                <StatusChip status={d.status} />
                <a href={`/api/reports/${d.id}`} target="_blank" className="text-brand-700 underline">Report</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
