import { ChevronDown, FileText } from "lucide-react";
import type { ListeningPart } from "@/lib/ielts/types";
import { cn } from "@/lib/utils";

/**
 * The transcript of one Listening part, collapsed by default ("Show
 * transcript"). Speaker names are bold; Narrator announcements are muted.
 * Server component — native <details>.
 */

const isNarrator = (speaker: string) => speaker.trim().toLowerCase() === "narrator";

export function TranscriptDetails({ part, no }: { part: ListeningPart; no: number }) {
  const lines = part.script.filter((l) => l && typeof l.text === "string" && l.text.trim());
  if (!lines.length) return null;

  return (
    <details className="group mt-4 rounded-xl border border-white/10 bg-white/[0.02] print:hidden">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 rounded-xl px-4 text-sm font-semibold text-gray-100 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <FileText className="h-4 w-4 shrink-0 text-averna-purple" aria-hidden />
        <span className="flex-1">
          <span className="group-open:hidden">Show transcript</span>
          <span className="hidden group-open:inline">Hide transcript</span>
          <span className="sr-only"> — Part {no}</span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="border-t border-white/10 px-4 pb-5 pt-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Transcript · Part {no}</p>
        {part.context && <p className="mt-1 text-sm italic text-gray-400">{part.context}</p>}
        <ol role="list" className="mt-4 space-y-2.5 text-[15px] leading-relaxed">
          {lines.map((l, i) => {
            const narrator = isNarrator(l.speaker);
            return (
              <li key={i} className={cn(narrator ? "italic text-gray-400" : "text-gray-200")}>
                <span className={cn("mr-2", narrator ? "font-medium text-gray-500" : "font-bold text-white")}>
                  {l.speaker || "Speaker"}:
                </span>
                {l.text}
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}
