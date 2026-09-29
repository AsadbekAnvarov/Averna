import { Loader2 } from "lucide-react";

/** Full-screen placeholder shaped like the Writing test while the tasks are chosen. */
export default function WritingExamLoading() {
  return (
    <div className="exam-shell fixed inset-0 z-[70] flex flex-col bg-[#040b09] text-gray-100" aria-busy="true">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(11,143,106,0.16),transparent_70%)]"
      />
      <div className="relative flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4 sm:px-5" aria-hidden>
        <div className="skeleton h-8 w-20 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="skeleton h-3.5 w-28" />
          <div className="skeleton h-3 w-56 max-w-[60%]" />
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="av-panel av-panel-hero rounded-3xl p-6 sm:p-8">
            <div className="skeleton h-3 w-28" aria-hidden />
            <div className="skeleton mt-3 h-7 w-72 max-w-full" aria-hidden />
            <div className="skeleton mt-3 h-3.5 w-full max-w-md" aria-hidden />
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="skeleton h-3 w-16" />
                  <div className="skeleton mt-2.5 h-4 w-32" />
                  <div className="skeleton mt-2 h-3 w-full" />
                </div>
              ))}
            </div>
            <p role="status" className="mt-6 flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 text-averna-neon motion-safe:animate-spin" aria-hidden />
              Preparing your Writing test…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
