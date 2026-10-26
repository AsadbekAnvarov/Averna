"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Pencil, Save, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DASH_CARD, DASH_CENTER } from "@/components/ui/dash-row";
import { cn } from "@/lib/utils";
import { bandForecast, examLine, formatBand, formatDay, overallLine, type ForecastInput } from "@/lib/forecast/band-forecast";
import { useExamDate } from "./use-exam-date";

/**
 * Today's compact "Path to 7.0": the overall forecast in one line plus the exam
 * date (this card replaced the old Exam Countdown — same device key), linking
 * to the full forecast on Progress.
 */
export function PathToTargetCard({ input }: { input: ForecastInput }) {
  const [examDate, saveExamDate, loaded] = useExamDate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const f = useMemo(() => bandForecast(input, { examDate }), [input, examDate]);
  const target = formatBand(f.targetBand);
  const exam = examLine(f);
  const firstMissing = f.missing[0];
  const passed = loaded && !!examDate && f.examDate == null;

  const startEditing = () => {
    setDraft(examDate ?? "");
    setEditing(true);
  };
  const save = () => {
    saveExamDate(draft);
    setEditing(false);
  };

  return (
    <Card className={cn(DASH_CARD, "glass border-averna-pink/30")} data-testid="path-to-target">
      <CardContent className="flex flex-1 flex-col p-3.5 sm:p-5">
        <div className="mb-1 flex min-h-[44px] items-center gap-2 text-averna-pink">
          <Target className="h-5 w-5" aria-hidden />
          <h3 className="font-semibold">Path to {target}</h3>
          {loaded && !editing && (
            <button
              type="button"
              onClick={startEditing}
              className="-mr-2.5 ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-white"
              title={examDate ? "Change exam date" : "Set exam date"}
              aria-label={examDate ? "Change exam date" : "Set exam date"}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <div className={cn(DASH_CENTER, "gap-2")}>
          {f.overall ? (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-bold leading-none text-white">≈ {formatBand(f.overall.now)}</span>
              <span className="text-sm text-gray-400">
                now · range {formatBand(f.overall.range[0])}–{formatBand(f.overall.range[1])}
              </span>
            </p>
          ) : null}
          <p className="text-sm text-gray-300">{overallLine(f)}</p>
          {!f.overall && firstMissing && (
            <Link href={firstMissing.href} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-study-ink hover:underline">
              Practise {firstMissing.label} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}

          {editing ? (
            <div className="space-y-2">
              <label htmlFor="exam-date" className="block text-sm text-gray-400">
                When is your IELTS exam?
              </label>
              <div className="flex gap-2">
                <input
                  id="exam-date"
                  type="date"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[44px] min-w-0 flex-1 rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={!draft}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-averna-primary/80 px-3 py-2 text-sm font-medium text-white hover:bg-averna-primary disabled:opacity-50"
                >
                  <Save className="h-4 w-4" aria-hidden /> Save
                </button>
              </div>
            </div>
          ) : exam ? (
            <p className="flex items-start gap-1.5 text-sm text-gray-300">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-averna-pink" aria-hidden />
              <span>
                {exam} <span className="text-gray-400">({formatDay(f.examDate!, f.todayKey)})</span>
              </span>
            </p>
          ) : loaded ? (
            <button type="button" onClick={startEditing} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-averna-pink hover:underline">
              <CalendarClock className="h-4 w-4" aria-hidden />
              {passed ? "Your exam date has passed — set a new one" : "Set your exam date"}
            </button>
          ) : null}
        </div>

        <Link
          href="/progress#forecast"
          className="mt-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-study-ink hover:underline"
        >
          See your forecast <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
