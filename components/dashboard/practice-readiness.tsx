import type { practiceReadiness } from "@/lib/assessment/readiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import Link from "next/link";
type Summary = ReturnType<typeof practiceReadiness>;
/** Presentational component also exercised in mobile browser fixtures. */
export function PracticeReadiness({ summary, targetBand }: { summary: Summary; targetBand?: string | null }) {
  const target = targetBand ? Number(targetBand.replace(/[^0-9.]/g, "")) : NaN;
  return <Card className="glass min-w-0 border-averna-cyan/30">
    <CardHeader><CardTitle className="flex items-start gap-2 text-white"><Target aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-study-ink" />Practice evidence</CardTitle>
      <p className="text-sm text-gray-300">The last 90 days. No predicted IELTS score.</p></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        <p className="text-sm text-gray-300">Four-skill practice summary</p>
        <p className="mt-2 text-3xl font-bold text-white">{summary.overall == null ? "Not enough evidence" : summary.overall.toFixed(1)}</p>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">{summary.narrative}</p>
        {Number.isFinite(target) && target > 0 && target <= 9 && <p className="mt-3 text-sm text-gray-300">Your goal: Band {target.toFixed(1)}. Practice results do not confirm that a goal is achieved.</p>}
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Evidence by skill">
        {summary.perSkill.map(s => <li key={s.key} className="min-w-0 rounded-xl border border-white/15 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold text-white">{s.label}</h3><span className="text-xl font-bold text-white">{s.current == null ? "—" : s.current.toFixed(1)}</span></div>
          <p className="mt-2 text-sm text-gray-300">{s.current == null ? "No eligible recent results" : "Recent practice median"}</p>
          {s.range && <p className="mt-1 text-sm text-gray-300">Observed: {s.range[0].toFixed(1)}–{s.range[1].toFixed(1)}.</p>}
          {s.sampleSize > 0 && <p className="mt-2 text-sm leading-relaxed text-gray-300">{s.basis}</p>}
          {!!s.sources.length && <p className="mt-2 break-words text-sm text-gray-300">Source: {s.sources.join(", ")}</p>}
          {!!s.excluded && <p className="mt-2 text-sm text-gray-300">{s.excluded} repeated or ineligible record{s.excluded === 1 ? "" : "s"} excluded.</p>}
        </li>)}
      </ul>
      <p className="text-sm text-gray-300">Observed ranges describe past practice, not future scores. Two complete, distinct-content results on different days per skill are needed for the overall summary. This threshold is an evidence rule, not a validated confidence level.</p>
      <Link href="/learning" className="inline-flex min-h-11 items-center rounded-lg border border-averna-cyan/40 px-4 text-sm font-medium text-study-ink focus-visible:outline focus-visible:outline-2">Open practice library →</Link>
    </CardContent>
  </Card>;
}
