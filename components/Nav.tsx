"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Primary navigation; the current page is marked for screen readers and visually. */
export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // The longest link that matches the current path is the current page (e.g. /doctor/new beats /doctor).
  const current = items
    .filter((n) => path === n.href || path.startsWith(`${n.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm">
      {items.map((n) => {
        const on = n.href === current;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`nav-link inline-flex min-h-14 items-center px-3 font-medium transition-colors ${
              on ? "text-brand-800" : "text-slate-700 hover:text-brand-800"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
