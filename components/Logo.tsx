/** Nidaan Setu mark: a bridge (setu) over a pulse line (nidaan = diagnosis). Decorative: label the link around it. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="6" fill="var(--color-brand-700)" />
      <path d="M4 21c4-7 8-10 12-10s8 3 12 10" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 21v-4.5M12 21v-7.2M16 21v-8M20 21v-7.2M24 21v-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 25h7l1.5-2.5 2 4 2-5 1.5 3.5h11" fill="none" stroke="var(--color-india-saffron)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Thin tricolour accent strip (decorative only, not an official emblem). */
export function TricolourStrip() {
  return (
    <div aria-hidden="true" className="flex h-1">
      <span className="flex-1 bg-india-saffron" />
      <span className="flex-1 bg-white" />
      <span className="flex-1 bg-india-green" />
    </div>
  );
}
