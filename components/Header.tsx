import Link from "next/link";
import { logout } from "@/app/actions";
import { clockOffsetHours } from "@/lib/queries";
import { getUser } from "@/lib/session";
import { DemoControls } from "./DemoControls";
import { LogoMark, TricolourStrip } from "./Logo";
import { Nav, type NavItem } from "./Nav";

const ROLE_NAV: Record<string, NavItem[]> = {
  doctor: [
    { href: "/doctor", label: "My referrals" },
    { href: "/doctor/new", label: "New referral" },
    { href: "/doctor/queue", label: "Hospital queue" },
  ],
  lab: [{ href: "/lab", label: "Lab desk" }],
  dho: [{ href: "/dho", label: "District dashboard" }],
};
const COMMON_NAV: NavItem[] = [
  { href: "/phone", label: "Patient phone" },
  { href: "/audit", label: "Audit log" },
];

export async function Header() {
  // If the database is down, still render the header (the login page shows the actual error).
  const [u, offsetH] = await Promise.all([getUser(), clockOffsetHours()]).catch(() => [null, 0] as const);
  return (
    <header className="no-print sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(203_213_225)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-20 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to main content
      </a>
      <TricolourStrip />
      {/* identity strip */}
      <div className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-xs">
          <span>
            <span lang="hi">निदान सेतु</span> · District diagnostic referral network
          </span>
          <span className="rounded bg-amber-300 px-2 py-0.5 font-semibold text-amber-950">
            Pilot concept · synthetic demo data · not an official government service
          </span>
        </div>
      </div>
      {/* main bar */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4">
        <Link href="/" className="flex min-h-14 items-center gap-2.5" aria-label="Nidaan Setu home">
          <LogoMark />
          <span className="leading-tight">
            <span className="block text-lg font-bold text-brand-800">Nidaan Setu</span>
            <span className="block text-xs text-slate-600">Diagnostic referral desk</span>
          </span>
        </Link>
        <Nav items={[...(u ? ROLE_NAV[u.role] ?? [] : []), ...COMMON_NAV]} />
        <div className="ml-auto flex items-center gap-2 py-2 text-sm">
          {u ? (
            <>
              <span className="hidden text-right leading-tight sm:block">
                <span className="block font-semibold text-slate-900">{u.name}</span>
                <span className="block text-xs text-slate-600">
                  {u.role}
                  {u.hospital_name ? ` · ${u.hospital_name}` : ""}
                </span>
              </span>
              <form action={logout}>
                <button className="inline-flex min-h-11 items-center rounded-md border border-slate-400 px-3 text-sm font-medium hover:bg-slate-50">
                  Switch user
                </button>
              </form>
            </>
          ) : (
            <Link href="/" className="inline-flex min-h-11 items-center rounded-md border border-slate-400 px-3 text-sm font-medium hover:bg-slate-50">
              Log in
            </Link>
          )}
          <DemoControls offsetH={offsetH} />
        </div>
      </div>
    </header>
  );
}
