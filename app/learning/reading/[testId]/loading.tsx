import { Loader2 } from "lucide-react";

/** Full-screen placeholder shaped like the exam shell while the paper loads. */
export default function ReadingTestLoading() {
  return (
    <div className="exam-shell fixed inset-0 z-[70] flex flex-col bg-[#040b09] text-gray-100" aria-busy="true">
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 sm:px-6" aria-hidden>
        <div className="skeleton h-4 w-48 max-w-[50%]" />
        <div className="skeleton h-8 w-24 rounded-lg" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden flex-1 space-y-3 border-r border-white/10 p-6 lg:block" aria-hidden>
          <div className="skeleton h-5 w-2/3" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-3.5 w-full" />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <p role="status" className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 text-averna-neon motion-safe:animate-spin" aria-hidden />
            Preparing your Reading test…
          </p>
        </div>
      </div>
      <div className="flex h-16 shrink-0 items-center gap-1.5 overflow-hidden border-t border-white/10 px-4 sm:px-6" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-9 shrink-0 rounded-md" />
        ))}
      </div>
    </div>
  );
}
