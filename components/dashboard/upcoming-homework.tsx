import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, BookOpen, Calendar, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { examHomeworkHref } from "@/lib/homework/exam-homework";
import { EXAM_KIND_INFO, dueState, examHomeworkLabel, examResultHref, isLibraryKind } from "@/lib/homework/library-shared";

/**
 * Dashboard: the student's pending homework. Exam homework (from the test
 * library) shows what it is and starts straight in the exam runner; done exam
 * homework (when the caller passes `submission`) shows its band and result.
 * Server component.
 */

interface UpcomingHomeworkProps {
  homework: Array<{
    id: string;
    title: string;
    description: string;
    dueDate: Date;
    points: number;
    difficulty: number;
    module: string;
    teacher: {
      user: {
        name: string | null;
      };
    };
    /** Exam homework from the test library (null / absent = classic free-text homework). */
    contentKind?: string | null;
    contentId?: string | null;
    contentPart?: number | null;
    contentTitle?: string | null;
    /** The student's submission, when the caller includes done homework. */
    submission?: { band: number | null; testId: string | null } | null;
  }>;
}

const getModuleColor = (module: string) => {
  switch (module) {
    case "WRITING":
      return "text-purple-400 bg-purple-500/10 border-purple-500/30";
    case "READING":
      return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    case "LISTENING":
      return "text-green-400 bg-green-500/10 border-green-500/30";
    case "SPEAKING":
      return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    default:
      return "text-gray-400 bg-gray-500/10 border-gray-500/30";
  }
};

export function UpcomingHomework({ homework }: UpcomingHomeworkProps) {
  if (homework.length === 0) {
    return (
      <Card className="glass border-averna-primary/30 animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-averna-neon" />
            Upcoming Homework
          </CardTitle>
          <CardDescription>Your pending assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No upcoming homework</p>
            <p className="text-sm mt-1">Check back later for new assignments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-averna-primary/30 animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-averna-neon" />
              Upcoming Homework
            </CardTitle>
            <CardDescription>{homework.length} pending assignment{homework.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          <Link href="/homework">
            <Button variant="ghost" size="sm" className="text-averna-neon hover:bg-averna-primary/20">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <ul role="list" className="space-y-3">
          {homework.map((hw) => {
            const due = dueState(hw.dueDate);
            const kind = isLibraryKind(hw.contentKind) ? hw.contentKind : null;
            const detailHref = `/homework/${encodeURIComponent(hw.id)}`;
            const startHref = kind
              ? examHomeworkHref({ id: hw.id, contentKind: hw.contentKind ?? null, contentId: hw.contentId ?? null, contentPart: hw.contentPart ?? null })
              : null;
            const done = hw.submission ?? null;

            return (
              <li
                key={hw.id}
                className="relative p-4 rounded-lg border border-averna-primary/20 hover:border-averna-neon/50 transition-all duration-300 hover:shadow-neon-green bg-averna-dark/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${getModuleColor(hw.module)}`}>
                        {kind ? examHomeworkLabel(hw) : hw.module}
                      </span>
                      {!kind && <span className="text-xs text-gray-400">{"⭐".repeat(hw.difficulty)}</span>}
                      {due.overdue && !done && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-red-400/40 bg-red-500/10 text-red-300 font-semibold">
                          Overdue
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-white truncate mb-1">
                      {/* Stretched link: the whole card opens the homework; the Start / result links sit above it. */}
                      <Link href={detailHref} className="after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:underline">
                        {hw.title}
                      </Link>
                    </h4>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                      {kind ? hw.contentTitle || EXAM_KIND_INFO[kind].blurb : hw.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(hw.dueDate)}
                      </span>
                      {!done && (
                        <span className="flex items-center gap-1">
                          <Clock className={due.urgent ? "h-3 w-3 text-red-400" : "h-3 w-3"} />
                          <span className={due.urgent ? "text-red-400 font-semibold" : ""}>{due.label}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-averna-neon font-bold text-lg">{hw.points}</div>
                    <div className="text-xs text-gray-400">points</div>
                  </div>
                </div>

                {kind && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {done ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-averna-neon">
                          <CheckCircle2 className="h-4 w-4" aria-hidden />
                          Done{typeof done.band === "number" ? ` · band ${done.band.toFixed(1)}` : ""}
                        </span>
                        {done.testId && (
                          <Link
                            href={examResultHref(kind, done.testId)}
                            className="relative z-10 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-gray-200 hover:border-averna-cyan/40 hover:text-white"
                          >
                            <BarChart3 className="h-3.5 w-3.5" aria-hidden /> View result
                          </Link>
                        )}
                      </>
                    ) : startHref ? (
                      <Link
                        href={startHref}
                        className={cn(
                          "relative z-10 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition-colors",
                          "bg-averna-primary hover:bg-averna-light"
                        )}
                      >
                        Start <span className="sr-only">{hw.title}</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
