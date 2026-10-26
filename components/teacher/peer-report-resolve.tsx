"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

/** "Resolve" for one open peer speaking report on /teacher/speaking. */
export function PeerReportResolve({ reportId, unpauses, name }: { reportId: string; unpauses: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resolve = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/teacher/speaking/reports/${encodeURIComponent(reportId)}/resolve`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(d.error || "Couldn't resolve. Try again.");
      else router.refresh();
    } catch {
      setError("Connection problem. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void resolve()}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-averna-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Resolve
      </button>
      {unpauses && <p className="text-xs text-averna-cyan">Resolving unpauses {name}&apos;s peer speaking.</p>}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
