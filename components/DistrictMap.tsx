"use client";

/**
 * District map for the DHO dashboard. Pure inline SVG, projected from tb.hospitals lat/lng:
 * no map tiles, no API key, no package, so it also works offline (start:lan).
 * Marker size = referrals accepted (filtered range), colour = current wait days (utilisation).
 * Arrows = referrals booked and not yet closed (accepted … report_sent), updated by live polling.
 */
import { useState } from "react";
import { Icon } from "@/components/Icon";

export type MapHospital = {
  id: string; name: string; short_name: string; kind: string; lat: number; lng: number;
  sent: number; received: number; accepted: number; declined: number; offers: number; tests_done: number;
  accepted_today: number; done_today: number; no_shows: number; avg_accept_min: number | null; wait_days: number | null;
  tests: { test: string; is_free: boolean; price_inr: number | null; wait: number }[];
  offers_test: boolean; is_referrer: boolean;
};
export type MapFlow = { from: string; to: string; n: number; codes: string };

const W = 640, H = 440, PAD = 56, KM_PER_DEG = 111.32;
const RINGS = [10, 20, 30];

/** Utilisation colour from current wait days: short wait = spare capacity. */
function tone(h: MapHospital) {
  if (!h.offers_test) return { fill: "#f1f5f9", stroke: "#94a3b8", label: "does not offer this test", labelHi: "यह जाँच नहीं" };
  const w = h.wait_days ?? 0;
  if (w <= 1) return { fill: "#10b981", stroke: "#047857", label: "spare capacity (≤1 day wait)", labelHi: "जगह खाली" };
  if (w <= 3) return { fill: "#f59e0b", stroke: "#b45309", label: "busy (2–3 days wait)", labelHi: "व्यस्त" };
  return { fill: "#e11d48", stroke: "#9f1239", label: "overloaded (>3 days wait)", labelHi: "भीड़" };
}

const fmtMin = (m: number | null) => (m == null ? "—" : m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export function DistrictMap({ hospitals, flows, testLabel }: { hospitals: MapHospital[]; flows: MapFlow[]; testLabel: string }) {
  const [sel, setSel] = useState<string | null>(null);
  if (hospitals.length === 0) return null;

  // Equirectangular projection fitted to the district (good enough at district scale).
  const lat0 = hospitals.reduce((s, h) => s + h.lat, 0) / hospitals.length;
  const kx = KM_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  const xs = hospitals.map((h) => h.lng * kx), ys = hospitals.map((h) => h.lat * KM_PER_DEG);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pxPerKm = Math.min((W - 2 * PAD) / Math.max(maxX - minX, 1), (H - 2 * PAD) / Math.max(maxY - minY, 1));
  const offX = (W - (maxX - minX) * pxPerKm) / 2, offY = (H - (maxY - minY) * pxPerKm) / 2;
  const pos = (h: MapHospital) => ({ x: offX + (h.lng * kx - minX) * pxPerKm, y: offY + (maxY - h.lat * KM_PER_DEG) * pxPerKm });
  const byId = new Map(hospitals.map((h) => [h.id, h]));
  const referrers = hospitals.filter((h) => h.is_referrer);
  const maxAcc = Math.max(1, ...hospitals.map((h) => h.accepted));
  const radius = (h: MapHospital) => 11 + 9 * Math.sqrt(h.accepted / maxAcc);
  const selected = sel ? byId.get(sel) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50/40">
        {/* small screens: the map keeps a readable size and pans sideways inside its card */}
        <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px] sm:min-w-0" role="img"
          aria-label={`District map: ${hospitals.length} facilities, ${flows.reduce((s, f) => s + f.n, 0)} active referrals shown as arrows. ${testLabel}.`}>
          <defs>
            <pattern id="dm-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
            <marker id="dm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="#1d4f86" />
            </marker>
          </defs>
          <rect width={W} height={H} fill="url(#dm-grid)" />

          {/* distance rings around each referring hospital */}
          {referrers.map((a) => {
            const p = pos(a);
            return RINGS.map((km) => (
              <g key={`${a.id}-${km}`}>
                <circle cx={p.x} cy={p.y} r={km * pxPerKm} fill="none" stroke="#94a3b8" strokeDasharray="4 5" strokeWidth="1" />
                <text x={p.x + km * pxPerKm * 0.71 + 3} y={p.y - km * pxPerKm * 0.71 - 3} fontSize="11" fill="#64748b">{km} km</text>
              </g>
            ));
          })}

          {/* live referral arrows: referring hospital → booked lab */}
          {flows.map((f) => {
            const a = byId.get(f.from), b = byId.get(f.to);
            if (!a || !b) return null;
            const p = pos(a), q = pos(b);
            const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
            const end = { x: q.x - (dx / len) * (radius(b) + 4), y: q.y - (dy / len) * (radius(b) + 4) };
            const mid = { x: (p.x + end.x) / 2 - (dy / len) * 24, y: (p.y + end.y) / 2 + (dx / len) * 24 };
            return (
              <g key={`${f.from}-${f.to}`}>
                <path d={`M${p.x} ${p.y} Q${mid.x} ${mid.y} ${end.x} ${end.y}`} fill="none" stroke="#1d4f86"
                  strokeWidth={2 + Math.min(f.n, 5)} strokeLinecap="round" markerEnd="url(#dm-arrow)" className="flow-line" opacity="0.8">
                  <title>{`${a.short_name} → ${b.short_name}: ${f.n} active (${f.codes})`}</title>
                </path>
                <text x={mid.x} y={mid.y} fontSize="12" fontWeight="700" fill="#17426f" textAnchor="middle"
                  stroke="#fff" strokeWidth="4" paintOrder="stroke">{f.n}</text>
              </g>
            );
          })}

          {/* facilities */}
          {hospitals.map((h) => {
            const p = pos(h), t = tone(h), on = sel === h.id;
            const open = () => setSel(h.id); // hover also selects, so click must not toggle off
            return (
              <g key={h.id} role="button" tabIndex={0} aria-pressed={on} className="cursor-pointer outline-none"
                aria-label={`${h.name}. ${h.is_referrer ? "Referring hospital" : t.label}.`}
                onClick={open} onMouseEnter={() => setSel(h.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}>
                {h.is_referrer ? (
                  <>
                    <rect x={p.x - 16} y={p.y - 16} width="32" height="32" rx="8" fill="#17426f" stroke={on ? "#ff9933" : "#fff"} strokeWidth="3" />
                    <path d={`M${p.x - 2.5} ${p.y - 9}h5v6.5h6.5v5h-6.5v6.5h-5v-6.5h-6.5v-5h6.5z`} fill="#fff" />
                  </>
                ) : (
                  <circle cx={p.x} cy={p.y} r={radius(h)} fill={t.fill} fillOpacity={h.offers_test ? 0.9 : 1}
                    stroke={on ? "#17426f" : t.stroke} strokeWidth={on ? 4 : 2} />
                )}
                {!h.is_referrer && h.offers_test && h.accepted > 0 && (
                  <text x={p.x} y={p.y + 4} fontSize="12" fontWeight="800" fill="#fff" textAnchor="middle">{h.accepted}</text>
                )}
                <text x={p.x} y={p.y + (h.is_referrer ? 30 : radius(h) + 15)} fontSize="12.5" fontWeight="700" fill="#0f172a"
                  textAnchor="middle" stroke="#fff" strokeWidth="4" paintOrder="stroke">{h.short_name}</text>
              </g>
            );
          })}

          {/* scale bar */}
          <g transform={`translate(16 ${H - 22})`}>
            <rect width={10 * pxPerKm} height="5" fill="#334155" />
            <text y="-5" fontSize="11" fill="#334155">10 km</text>
          </g>
        </svg>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-brand-800" /> Referring hospital <span lang="hi">/ रेफ़र करने वाला</span></li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Spare capacity <span lang="hi">/ जगह खाली</span></li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" /> Busy <span lang="hi">/ व्यस्त</span></li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-600" /> Overloaded <span lang="hi">/ भीड़</span></li>
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-brand-700" /> Active referral <span lang="hi">/ चालू रेफ़रल</span></li>
          <li>Circle size = referrals accepted</li>
        </ul>
      </div>

      <aside aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        {selected ? <Details h={selected} /> : (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-slate-500">
            <Icon name="mapPin" size={28} className="text-brand-600" />
            Hover or tap a facility to see its details.
            <span lang="hi">विवरण देखने के लिए किसी अस्पताल पर टैप करें।</span>
          </div>
        )}
      </aside>
    </div>
  );
}

function Details({ h }: { h: MapHospital }) {
  const t = tone(h);
  const rows: [string, string, string][] = h.is_referrer
    ? [["Referrals sent", "भेजे गए रेफ़रल", String(h.sent)], ["Tests done for others", "दूसरों की जाँचें", String(h.tests_done)]]
    : [
        ["Requests received", "मिले अनुरोध", String(h.received)],
        ["Acceptance rate", "स्वीकार दर", `${pct(h.accepted, h.received)} (${h.accepted})`],
        ["Offers sent", "भेजे गए ऑफ़र", String(h.offers)],
        ["Accepted today", "आज स्वीकार", String(h.accepted_today)],
        ["Tests done today", "आज जाँचें", String(h.done_today)],
        ["Avg. time to accept", "स्वीकार में औसत समय", fmtMin(h.avg_accept_min)],
        ["No-shows", "नहीं पहुँचे", String(h.no_shows)],
      ];
  return (
    <div className="toast-in space-y-3">
      <div>
        <div className="font-bold text-slate-900">{h.name}</div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          <span className={`rounded px-1.5 py-0.5 ${h.kind === "ppp" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
            {h.kind === "ppp" ? "PPP · paid" : "Govt"}
          </span>
          {h.is_referrer
            ? <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">Referring hospital</span>
            : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">{t.label} <span lang="hi">· {t.labelHi}</span></span>}
        </div>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        {rows.map(([en, hi, v]) => (
          <div key={en} className="contents">
            <dt className="text-slate-600">{en} <span lang="hi" className="text-xs text-slate-400">{hi}</span></dt>
            <dd className="text-right font-semibold tabular-nums text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div>
        <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Tests · current wait <span lang="hi">/ जाँचें · इंतज़ार</span></div>
        <ul className="space-y-0.5">
          {h.tests.map((x) => (
            <li key={x.test} className="flex justify-between gap-2">
              <span>{x.test} <span className="text-xs text-slate-500">{x.is_free ? "free" : `₹${x.price_inr}`}</span></span>
              <span className="tabular-nums text-slate-700">{x.wait} d</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
