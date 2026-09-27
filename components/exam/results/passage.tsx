import { BookOpen, ChevronDown } from "lucide-react";
import { partWordCount } from "@/lib/ielts/format";
import type { ReadingPart } from "@/lib/ielts/types";

/**
 * The Reading passage behind a set of answers, collapsed by default
 * ("Show passage"), with paragraph labels (A, B …) so explanations that point
 * to a paragraph are easy to check. Server component — native <details>.
 */
export function PassageDetails({ part, no }: { part: ReadingPart; no: number }) {
  const paragraphs = part.paragraphs.filter((p) => p.text.trim());
  if (!paragraphs.length) return null;
  const words = partWordCount(part);

  return (
    <details className="group mt-4 rounded-xl border border-white/10 bg-white/[0.02] print:hidden">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 rounded-xl px-4 text-sm font-semibold text-gray-100 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <BookOpen className="h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
        <span className="flex-1">
          <span className="group-open:hidden">Show passage</span>
          <span className="hidden group-open:inline">Hide passage</span>
          <span className="sr-only"> — Reading Passage {no}</span>
          {words > 0 && <span className="ml-2 font-normal text-gray-500">· about {Math.round(words / 10) * 10} words</span>}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="border-t border-white/10 px-4 pb-5 pt-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Reading Passage {no}</p>
        <p className="mt-1 text-base font-semibold text-white">{part.title}</p>
        {part.subtitle && <p className="mt-1 text-sm italic text-gray-400">{part.subtitle}</p>}
        <div className="mt-4 space-y-3.5 text-[15px] leading-relaxed text-gray-200">
          {paragraphs.map((p, i) => (
            <p key={`${p.label ?? ""}${i}`} className="flex gap-3">
              {p.label ? (
                <span className="w-5 shrink-0 font-bold text-averna-cyan">
                  <span className="sr-only">Paragraph </span>
                  {p.label}
                </span>
              ) : null}
              <span className="min-w-0">{p.text}</span>
            </p>
          ))}
        </div>
      </div>
    </details>
  );
}
