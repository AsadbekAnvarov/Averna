"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, ClipboardCheck, HeartHandshake, Loader2, MessageSquare, ShieldAlert, Target } from "lucide-react";
import { DASH_CARD } from "@/components/ui/dash-row";
import { MiniTaskSheet } from "@/components/teacher/mini-task-sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { NEEDS_HELP_SHOWN, firstNameOf, type NeedsHelpRow } from "@/lib/teacher/needs-help";

/**
 * "Who needs help today" — the teacher's morning list (idea 10). Each row: who,
 * which group, up to three reasons as chips, and one-tap actions: Message (the
 * messages page with an editable draft — AI-written when available), Mini task
 * (a part aimed at the student's mistakes), Open (their Learning DNA) and the
 * suggested next step. "Done for today" hides a row on this device until the
 * next Tashkent day. Phones: stacked rows, 44 px actions; desktop: compact rows.
 */

export const NEEDS_HELP_DONE_KEY = "averna_needs_help_done_v1";

/** Ids marked "Done for today" on this device, for this Tashkent day only. */
export function readDone(todayKey: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(NEEDS_HELP_DONE_KEY) || "null") as { day?: unknown; ids?: unknown } | null;
    if (!raw || raw.day !== todayKey || !Array.isArray(raw.ids)) return [];
    return raw.ids.filter((x): x is string => typeof x === "string").slice(0, 500);
  } catch {
    return [];
  }
}

function writeDone(todayKey: string, ids: string[]) {
  try {
    localStorage.setItem(NEEDS_HELP_DONE_KEY, JSON.stringify({ day: todayKey, ids }));
  } catch {
    /* private mode: the row still hides for this visit */
  }
}

const ACTION =
  "inline-flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 lg:min-h-[36px] lg:rounded-lg lg:px-2.5";
/** Half a phone line each (two per line); natural width on desktop. */
const HALF = "flex-1 basis-[calc(50%-0.25rem)] lg:flex-none lg:basis-auto";
const PRIMARY = "bg-averna-primary text-white hover:bg-averna-light";
const SECONDARY = "border border-white/10 bg-white/[0.04] text-gray-100 hover:border-averna-cyan/40 hover:text-white";

const CHIP: Record<string, string> = {
  report: "border-red-400/30 bg-red-400/10 text-red-200",
  homework: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  inactive: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  absence: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  review: "border-averna-pink/30 bg-averna-pink/10 text-averna-pink",
  streak: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  mistakes: "border-averna-cyan/30 bg-averna-cyan/10 text-averna-cyan",
  falling: "border-averna-purple/30 bg-averna-purple/10 text-averna-purple",
  target: "border-averna-purple/30 bg-averna-purple/10 text-averna-purple",
};

export interface NeedsHelpListProps {
  rows: NeedsHelpRow[];
  todayKey: string;
  /** Students in the teacher's groups (for the empty state). */
  students: number;
  /** An AI key is configured: "Message" asks for an AI draft first. */
  aiDrafts: boolean;
}

export function NeedsHelpList({ rows, todayKey, students, aiDrafts }: NeedsHelpListProps) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<NeedsHelpRow | null>(null);

  useEffect(() => setDone(readDone(todayKey)), [todayKey]);

  const visible = useMemo(() => rows.filter((r) => !done.includes(r.id)), [rows, done]);
  const hidden = rows.length - visible.length;
  const shown = showAll ? visible : visible.slice(0, NEEDS_HELP_SHOWN);

  function markDone(row: NeedsHelpRow) {
    const next = Array.from(new Set([...done, row.id]));
    setDone(next);
    writeDone(todayKey, next);
    toast.info(`${firstNameOf(row.name)} is hidden until tomorrow.`);
  }

  function restore() {
    setDone([]);
    writeDone(todayKey, []);
  }

  async function message(row: NeedsHelpRow) {
    if (busy) return;
    let draft = row.messageDraft;
    if (aiDrafts) {
      setBusy(`${row.id}:message`);
      try {
        const res = await fetch("/api/teacher/needs-help/message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            studentId: row.id,
            firstName: firstNameOf(row.name),
            reasons: row.reasons.map((r) => r.text),
            miniTask: row.action.kind === "mini-task",
          }),
        });
        const data = (await res.json().catch(() => null)) as { draft?: string } | null;
        if (res.ok && data?.draft) draft = data.draft;
      } catch {
        /* the template draft is still a good start */
      } finally {
        setBusy(null);
      }
    }
    router.push(`/messages?with=${encodeURIComponent(row.userId)}&draft=${encodeURIComponent(draft)}`);
  }

  return (
    <section aria-labelledby="needs-help-title" data-testid="needs-help" className={cn(DASH_CARD, "glass border-averna-cyan/30 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="needs-help-title" className="flex items-center gap-2 text-lg font-semibold text-white">
          <HeartHandshake className="h-5 w-5 text-averna-cyan" aria-hidden />
          Who needs help today
        </h2>
        {visible.length > 0 && (
          <span className="rounded-full bg-averna-cyan/15 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-averna-cyan">
            <span className="sr-only">Students: </span>
            {visible.length}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-averna-neon/25 bg-averna-neon/[0.06] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-white">Everyone is on track today</p>
            <p className="mt-0.5 text-sm text-gray-300">
              {students > 0
                ? "No missed homework, long breaks, repeated mistakes or work waiting on you. Check back tomorrow."
                : "Once students join your groups, the ones who need a hand show up here."}
            </p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-averna-neon/25 bg-averna-neon/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm text-white">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
            Everyone on today&apos;s list is handled.
          </p>
          <button type="button" onClick={restore} className={cn(ACTION, SECONDARY)}>
            Show {hidden} hidden
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-400">Most urgent first — act in one tap, or mark a student done for today.</p>
          <ul role="list" className="mt-3 space-y-2.5">
            {shown.map((row) => {
              const primary = row.action.kind === "review" || row.action.kind === "reports" ? row.action : null;
              return (
                <li
                  key={row.id}
                  data-testid="needs-help-row"
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 lg:flex lg:items-center lg:gap-4 lg:py-2.5"
                >
                  <div className="flex min-w-0 items-start gap-3 lg:flex-1 lg:items-center">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-averna-cyan/15 text-sm font-bold text-averna-cyan"
                    >
                      {row.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-white">
                        {row.name}
                        <span className="ml-1.5 text-sm font-normal text-gray-400">· {row.group}</span>
                      </p>
                      <ul role="list" aria-label="Reasons" className="mt-1 flex flex-wrap gap-1.5">
                        {row.reasons.map((r) => (
                          <li key={r.kind} className={cn("max-w-full break-words rounded-full border px-2 py-0.5 text-xs", CHIP[r.kind] ?? CHIP.review)}>
                            {r.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Phones: two per line (Message | Mini task, Open | Done for today); desktop: one compact line. */}
                  <div className="mt-3 flex flex-wrap gap-2 lg:mt-0 lg:shrink-0 lg:justify-end">
                    {primary && (
                      <Link href={primary.href} aria-label={`${primary.label}: ${row.name}`} className={cn(ACTION, PRIMARY, "w-full lg:w-auto")}>
                        {primary.kind === "review" ? <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden /> : <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />}
                        <span className="truncate">{primary.label}</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => void message(row)}
                      disabled={busy === `${row.id}:message`}
                      aria-label={`Message ${row.name}`}
                      className={cn(ACTION, HALF, row.action.kind === "message" ? PRIMARY : SECONDARY)}
                    >
                      {busy === `${row.id}:message` ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <span className="truncate">Message</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheet(row)}
                      aria-label={`Mini task for ${row.name}`}
                      className={cn(ACTION, HALF, row.action.kind === "mini-task" ? PRIMARY : SECONDARY)}
                    >
                      <Target className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">Mini task</span>
                    </button>
                    <Link
                      href={`/teacher/learning-dna/${encodeURIComponent(row.id)}`}
                      aria-label={`Open ${row.name}`}
                      className={cn(ACTION, "flex-1 basis-[calc(40%-0.25rem)] lg:flex-none lg:basis-auto", SECONDARY)}
                    >
                      <span className="truncate">Open</span>
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                    </Link>
                    <button
                      type="button"
                      onClick={() => markDone(row)}
                      aria-label={`Done for today: ${row.name}`}
                      className={cn(ACTION, "flex-1 basis-[calc(60%-0.25rem)] px-2 lg:flex-none lg:basis-auto", "text-gray-300 hover:bg-white/5 hover:text-white")}
                    >
                      <CheckCircle2 className="hidden h-4 w-4 shrink-0 sm:inline" aria-hidden />
                      <span className="truncate">Done for today</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!showAll && visible.length > NEEDS_HELP_SHOWN && (
              <button type="button" onClick={() => setShowAll(true)} className={cn(ACTION, SECONDARY)}>
                Show all ({visible.length})
              </button>
            )}
            {hidden > 0 && (
              <button type="button" onClick={restore} className={cn(ACTION, "text-gray-300 hover:bg-white/5 hover:text-white")}>
                Show {hidden} done today
              </button>
            )}
          </div>
        </>
      )}

      {sheet && (
        <MiniTaskSheet studentId={sheet.id} studentName={sheet.name} open onClose={() => setSheet(null)} />
      )}
    </section>
  );
}
