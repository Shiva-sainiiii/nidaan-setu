"use client";

import { realtimeEnabled } from "@/lib/useLive";

export function LiveBadge({ stale }: { stale: boolean }) {
  if (stale)
    return (
      <span role="status" className="toast-in inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">
        <span className="h-2 w-2 rounded-full bg-rose-500" /> Connection lost, retrying…
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"
      title={realtimeEnabled ? "Supabase Realtime + polling" : "Updates every 2 seconds"}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}
