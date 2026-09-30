import { Loader2 } from "lucide-react";

/** Full-screen placeholder shaped like the Speaking test while the set loads. */
export default function SpeakingTestLoading() {
  return (
    <div className="exam-shell fixed inset-0 z-[70] flex flex-col bg-exam-bg pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-gray-100" aria-busy="true">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(11,143,106,0.16),transparent_70%)]"
      />
      <div className="relative flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4 sm:px-5" aria-hidden>
        <div className="skeleton h-8 w-16 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="skeleton h-3.5 w-32" />
          <div className="skeleton h-3 w-48 max-w-[60%]" />
        </div>
      </div>
      <div className="relative flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 sm:px-5" aria-hidden>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-2 w-14 rounded-full sm:w-20" />
          ))}
        </div>
        <div className="skeleton h-3 w-20" />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="skeleton h-24 w-24 rounded-full sm:h-32 sm:w-32" aria-hidden />
        <p role="status" className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 text-averna-neon motion-safe:animate-spin" aria-hidden />
          Preparing your Speaking test…
        </p>
      </div>
    </div>
  );
}
