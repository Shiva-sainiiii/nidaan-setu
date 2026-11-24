"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { transition } from "@/app/actions";
import { useIdemKey, useLive } from "@/lib/useLive";
import { fmtDT, relTime } from "@/lib/format";
import { Alert, Card, ConsentChip, PriorityChip, ScoreBreakdown, StatusChip, TempMedBadge, btnDanger, btnPrimary, btnSecondary, type Score } from "@/components/ui";
import { LiveBadge } from "@/components/LiveBadge";
import { Timeline, type AuditRow } from "@/components/Timeline";
import { Icon } from "@/components/Icon";

type R = {
  id: number; code: string; status: string; priority: string; on_temp_medication: boolean; note: string;
  test_name: string; patient_name: string; patient_phone: string; patient_age: number | null; abha_id: string | null;
  from_short: string; doctor_name: string; original_slot_at: string; created_at: string; expires_at: string;
  max_distance_km: number; radius_round: number; patient_token: string;
  lab_name: string | null; lab_short: string | null; lab_address: string | null; lab_phone: string | null; lab_distance_km: number | null;
  lab_is_free: boolean | null; lab_price: number | null; accepted_slot_at: string | null; test_done_at: string | null;
  days_saved: number | null; score: Score; now: string; bundle_code: string | null;
  offers_close_at: string | null; selection: Selection | null;
  consent_status: string; consent_requested_at: string | null; consent_answered_at: string | null;
};
type Ranked = { rank: number; lab: string; slot: string; km: number; is_free: boolean; cover: number };
type Selection = { offers: number; winner?: string; slot?: string; reason: string; ranked?: Ranked[]; closed_by?: string };
type Offer = { hospital_id: string; short_name: string; slot_at: string; distance_km: number; is_free: boolean; status: string };
type Sibling = { id: number; code: string; test_name: string; status: string; accepted_slot_at: string | null; lab_name: string | null };
type Recipient = { hospital_id: string; short_name: string; distance_km: number; response: string | null; round: number; is_free: boolean; price_inr: number | null };
type Data = { referral: R; recipients: Recipient[]; audit: AuditRow[]; siblings: Sibling[]; offers: Offer[]; report: { filename: string; reported_by_name: string; reg_no: string; uploaded_at: string } | null };

const RESP: Record<string, string> = {
  accepted: "bg-emerald-100 text-emerald-800", lost_race: "bg-slate-100 text-slate-600", declined: "bg-rose-100 text-rose-700",
  offered: "bg-sky-100 text-sky-800", not_selected: "bg-slate-100 text-slate-600",
};
const RESP_LABEL: Record<string, string> = { lost_race: "too late", not_selected: "not selected" };

export function ReferralDetail({ id, role }: { id: number; role: string }) {
  const { data, stale, error, refresh, now } = useLive<Data>(`/api/live?view=referral&id=${id}`);
  const [showViews, setShowViews] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [idem, rotateIdem] = useIdemKey();

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <p className="text-slate-500">Loading…</p>;
  const r = data.referral;
  const isDoctor = role === "doctor";
  const canCancel = isDoctor && ["open", "accepted", "patient_confirmed"].includes(r.status);
  const accepted = !["open", "expired", "cancelled"].includes(r.status);
  const nowMs = now ? new Date(now).getTime() : 0;
  const windowRunning = r.status === "open" && !!r.offers_close_at && new Date(r.offers_close_at).getTime() > nowMs;

  const act = (to: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      try {
        const res = await transition(id, to, idem);
        rotateIdem();
        setMsg(res.ok ? { kind: "success", text: "Done" } : { kind: "error", text: res.message ?? "Failed" });
        refresh();
      } catch {
        setMsg({ kind: "error", text: "Network problem, try again (safe to retry)." });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{r.code}</h1>
            <StatusChip status={r.status} />
            <PriorityChip p={r.priority} />
            {r.on_temp_medication && <TempMedBadge />}
            <ConsentChip status={r.consent_status} />
            {r.bundle_code && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white">BUNDLE {r.bundle_code}</span>}
          </div>
          <p className="text-sm text-slate-500">
            {r.test_name} · referred by {r.doctor_name}, {r.from_short} · {fmtDT(r.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveBadge stale={stale} />
          {accepted && isDoctor && <Link href={`/r/${id}/slip`} className={btnSecondary}>Print slip</Link>}
          <a href={`/s/${r.patient_token}`} target="_blank" className={btnSecondary}>Patient status page ↗</a>
        </div>
      </div>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {/* ---- headline banner per state */}
      {(r.status === "report_sent" || r.status === "closed") && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <div className="text-xl font-bold text-emerald-900">
            Report ready{r.days_saved != null && <>: {r.days_saved} days earlier</>}
          </div>
          <p className="text-sm text-emerald-900">
            Original slot {fmtDT(r.original_slot_at)} → test done {fmtDT(r.test_done_at)} at {r.lab_name}.
            The original slot was released to the next patient in your queue.
          </p>
          {data.report && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href={`/api/reports/${id}`} target="_blank" className={btnPrimary}>Open report (PDF)</a>
              <span className="text-sm text-emerald-900">
                Reported by {data.report.reported_by_name} (Reg. {data.report.reg_no}) · {fmtDT(data.report.uploaded_at)}
              </span>
              {isDoctor && r.status === "report_sent" && (
                <button className={btnSecondary} disabled={pending} onClick={() => act("closed")}>Mark reviewed & close</button>
              )}
            </div>
          )}
        </div>
      )}
      {r.status === "open" && r.consent_status === "pending_sms" && (
        <Alert kind="warn">
          <b>Waiting for the patient&apos;s consent by SMS</b> (asked {fmtDT(r.consent_requested_at)}). No lab has been notified and no
          patient data is shared until the patient replies <b>YES</b>. NO cancels; no reply by {fmtDT(r.expires_at)} expires the request.
          The patient keeps the original slot {fmtDT(r.original_slot_at)}.
        </Alert>
      )}
      {r.status === "cancelled" && r.consent_status === "refused" && (
        <Alert kind="info">The patient replied <b>NO</b> to the consent SMS ({fmtDT(r.consent_answered_at)}). Nothing was shared with any lab.</Alert>
      )}
      {r.status === "expired" && r.consent_status === "expired" && (
        <Alert kind="error">No reply to the consent SMS. Nothing was shared; the patient keeps the original date {fmtDT(r.original_slot_at)}.</Alert>
      )}
      {r.status === "open" && r.consent_status !== "pending_sms" && (
        <Alert kind="warn">
          Waiting for a lab: sent to {data.recipients.length} lab{data.recipients.length === 1 ? "" : "s"} within {r.max_distance_km} km
          {r.radius_round > 1 && " (radius widened)"}.{" "}
          {windowRunning
            ? <>Labs are sending offers; the <b>earliest slot wins</b> when the window closes {relTime(r.offers_close_at!, nowMs)} ({data.offers.length} offer{data.offers.length === 1 ? "" : "s"} so far).</>
            : <>The first lab to accept gets it; the request closes {now ? relTime(r.expires_at, nowMs) : ""}.</>}
          The patient keeps the original slot {fmtDT(r.original_slot_at)} meanwhile.
        </Alert>
      )}
      {r.status === "expired" && r.consent_status !== "expired" && (
        <Alert kind="error">No lab accepted. The patient keeps the original date {fmtDT(r.original_slot_at)} and was informed by SMS.</Alert>
      )}
      {r.status === "cancelled" && r.consent_status !== "refused" && <Alert kind="info">Cancelled. The patient keeps the original date {fmtDT(r.original_slot_at)}.</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {r.lab_name && (
            <Card>
              <div className="text-xs font-semibold uppercase text-slate-500">Booked at</div>
              <div className="text-lg font-semibold">{r.lab_name}</div>
              <div className="text-sm text-slate-600">{r.lab_address} · {r.lab_phone}</div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span>Slot: <b>{fmtDT(r.accepted_slot_at)}</b></span>
                <span>{r.lab_distance_km} km away</span>
                <span>{r.lab_is_free ? "Free (govt)" : `₹${r.lab_price} (PPP)`}</span>
              </div>
            </Card>
          )}

          {(r.offers_close_at || data.offers.length > 0) && <OffersCard r={r} offers={data.offers} running={windowRunning} />}

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Timeline and audit</h2>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input type="checkbox" checked={showViews} onChange={(e) => setShowViews(e.target.checked)} /> show data views
              </label>
            </div>
            <Timeline rows={data.audit} showViews={showViews} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-1 text-sm">
            <div className="text-xs font-semibold uppercase text-slate-500">Patient</div>
            <div className="font-semibold">{r.patient_name}{r.patient_age ? `, ${r.patient_age}` : ""}</div>
            <div className="flex items-center gap-1.5"><Icon name="smartphone" size={16} className="text-slate-500" /> {r.patient_phone}</div>
            {r.abha_id && <div>ABHA: {r.abha_id}</div>}
            <div className="text-slate-600">Original slot: {fmtDT(r.original_slot_at)}</div>
            {r.note && <div className="mt-2 rounded bg-slate-50 p-2 text-slate-700">“{r.note}”</div>}
          </Card>

          {data.siblings.length > 0 && (
            <Card className="space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-500">Other tests in bundle {r.bundle_code}</div>
              <ul className="space-y-1.5 text-sm">
                {data.siblings.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/r/${s.id}`} className="font-medium text-brand-800 hover:underline">{s.test_name} <span className="text-xs text-slate-500">{s.code}</span></Link>
                    <StatusChip status={s.status} />
                    {s.lab_name && <span className="w-full text-xs text-slate-500">{s.lab_name} · {fmtDT(s.accepted_slot_at)}</span>}
                  </li>
                ))}
              </ul>
              {(() => {
                const labs = new Set([r.lab_short, ...data.siblings.map((s) => s.lab_name)].filter(Boolean)); // both short names
                const total = data.siblings.length + 1;
                return labs.size > 0 && (
                  <p className={`rounded px-2 py-1 text-xs ${labs.size === 1 ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600"}`}>
                    {labs.size === 1 ? `All booked tests at one lab: one trip for ${total} tests.` : `Booked at ${labs.size} labs.`}
                  </p>
                );
              })()}
            </Card>
          )}

          <Card className="space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Urgency (shown to every lab)</div>
            <ScoreBreakdown score={r.score} />
            <p className="text-xs text-slate-500">Labs also see −1 per km of travel. Ordering is explainable, not hidden.</p>
          </Card>

          <Card>
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Labs notified</div>
            <ul className="space-y-1 text-sm">
              {data.recipients.map((x) => (
                <li key={x.hospital_id} className="flex items-center justify-between gap-2">
                  <span>{x.short_name} <span className="text-xs text-slate-500">{x.distance_km} km{x.round > 1 ? " · round 2" : ""}</span></span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${x.response ? RESP[x.response] : r.status === "open" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                    {x.response ? RESP_LABEL[x.response] ?? x.response : r.status === "open" ? "pending" : "closed"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {canCancel && (
            <button className={`${btnDanger} w-full`} disabled={pending}
              onClick={() => act("cancelled", "Cancel this referral? The patient keeps the original date.")}>
              Cancel: keep original date
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Offer window explainability: every offer, the winner and why. */
function OffersCard({ r, offers, running }: { r: R; offers: Offer[]; running: boolean }) {
  const sel = r.selection;
  const ranked = sel?.ranked;
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Icon name="clock" size={18} className="text-brand-700" /> Offer window: earliest slot wins</h2>
        <span className="text-xs text-slate-500">
          {running ? `open until ${fmtDT(r.offers_close_at)}` : sel ? `closed ${sel.closed_by === "all notified labs responded" ? "early: all labs answered" : "at the end of the window"}` : "closed"}
        </span>
      </div>
      {sel?.winner && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <b>{sel.winner}</b> chosen from {sel.offers} offer{sel.offers === 1 ? "" : "s"} · <span className="font-semibold">why: {sel.reason}</span>
        </div>
      )}
      {sel && !sel.winner && <p className="text-sm text-slate-600">No lab offered in the window. The first lab to accept now gets it.</p>}
      {ranked && ranked.length > 0 ? (
        <ol className="space-y-1 text-sm">
          {ranked.map((o) => (
            <li key={o.rank} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-1.5 ${o.rank === 1 ? "bg-emerald-50/60 font-semibold" : "bg-slate-50"}`}>
              <span>{o.rank}. {o.lab}</span>
              <span className="text-slate-700">{o.slot} · {o.km} km · {o.is_free ? "free" : "paid"}{o.cover > 1 ? ` · ${o.cover} tests, one trip` : ""}</span>
            </li>
          ))}
        </ol>
      ) : offers.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {offers.map((o) => (
            <li key={o.hospital_id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
              <span>{o.short_name}</span><span className="text-slate-700">{fmtDT(o.slot_at)} · {o.distance_km} km</span>
            </li>
          ))}
        </ul>
      ) : running ? <p className="text-sm text-slate-500">No offers yet.</p> : null}
      <p className="text-xs text-slate-500">Rule: whole bundle at one lab (one trip) → earliest slot → nearer → free lab → offered first.</p>
    </Card>
  );
}
