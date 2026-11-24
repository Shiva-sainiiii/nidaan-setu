/**
 * Animated explainer for the landing page: Hospital A sends one test request to three labs,
 * Lab B accepts (one winner), the patient gets an SMS. Pure SVG + CSS/SMIL; dots hide with reduced motion.
 */
const TO_B = "M128 92 C 200 92, 196 52, 268 52";
const TO_C = "M128 92 C 200 92, 200 138, 268 138";
const TO_D = "M128 92 C 200 92, 196 224, 268 224";
const SMS = "M268 64 C 196 80, 196 238, 128 238";

function Dot({ path, delay, color }: { path: string; delay: string; color: string }) {
  return (
    <circle className="flow-dot" r="4.5" fill={color}>
      <animateMotion dur="2.8s" begin={delay} repeatCount="indefinite" path={path} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1" />
    </circle>
  );
}

function Node({ x, y, w, h, title, sub, tone = "plain" }: {
  x: number; y: number; w: number; h: number; title: string; sub: string; tone?: "plain" | "brand" | "win" | "muted" | "patient";
}) {
  const style = {
    plain: { fill: "#fff", stroke: "#cbd5e1", t: "#0f172a", s: "#475569" },
    brand: { fill: "#17426f", stroke: "#17426f", t: "#fff", s: "#d9e6f2" },
    win: { fill: "#ecfdf5", stroke: "#10b981", t: "#065f46", s: "#047857" },
    muted: { fill: "#f8fafc", stroke: "#cbd5e1", t: "#64748b", s: "#94a3b8" },
    patient: { fill: "#fff7ed", stroke: "#ff9933", t: "#7c2d12", s: "#9a3412" },
  }[tone];
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={style.fill} stroke={style.stroke} strokeWidth="1.5" />
      <text x={x + 14} y={y + h / 2 - 3} fontSize="13" fontWeight="700" fill={style.t}>{title}</text>
      <text x={x + 14} y={y + h / 2 + 13} fontSize="11" fill={style.s}>{sub}</text>
    </g>
  );
}

export function FlowDiagram() {
  return (
    <svg viewBox="0 0 420 280" className="h-auto w-full" role="img"
      aria-label="Hospital A sends a test request to three nearby labs. Lab B accepts first; the others see already accepted. The patient receives an SMS in Hindi and English.">
      {/* connections */}
      <g fill="none" strokeWidth="2" strokeLinecap="round">
        <path d={TO_B} stroke="#10b981" className="flow-line" />
        <path d={TO_C} stroke="#94a3b8" className="flow-line" />
        <path d={TO_D} stroke="#94a3b8" className="flow-line" />
        <path d={SMS} stroke="#ff9933" className="flow-line" />
      </g>
      <Dot path={TO_B} delay="0s" color="#10b981" />
      <Dot path={TO_C} delay="0.15s" color="#64748b" />
      <Dot path={TO_D} delay="0.3s" color="#64748b" />
      <Dot path={SMS} delay="1.4s" color="#ff9933" />

      <Node x={8} y={64} w={120} h={56} title="Hospital A" sub="Doctor: MRI in 14 d" tone="brand" />
      <Node x={268} y={28} w={144} h={48} title="Lab B · 10 km" sub="✓ Accepted: tomorrow" tone="win" />
      <Node x={268} y={114} w={144} h={48} title="Lab C · 12 km" sub="Already accepted" tone="muted" />
      <Node x={268} y={200} w={144} h={48} title="Lab D · 15 km" sub="Already accepted" tone="muted" />
      <Node x={8} y={212} w={120} h={52} title="Patient" sub="SMS · हिंदी + English" tone="patient" />

      <g fontSize="10.5" fill="#475569" fontWeight="600">
        <text x="150" y="80">one request</text>
        <text x="150" y="196" fill="#9a3412">SMS + slip</text>
      </g>
    </svg>
  );
}
