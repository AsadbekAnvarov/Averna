import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { CRITERIA, CRITERION_INFO } from "@/lib/speaking/feedback-presets";
import type { PeerProgress } from "@/lib/speaking/peer-progress";

/** "Your peer speaking" on /learning/speaking for students (docs/peer-speaking.md, Phase C). */

const TREND = {
  up: { Icon: ArrowUpRight, label: "up", cls: "text-averna-neon" },
  down: { Icon: ArrowDownRight, label: "down", cls: "text-yellow-300" },
  flat: { Icon: Minus, label: "steady", cls: "text-gray-400" },
} as const;

export function PeerProgressCard({ progress }: { progress: PeerProgress }) {
  const empty = progress.sessionsThisWeek === 0 && progress.partnersThisMonth === 0 && progress.receivedCount === 0;
  return (
    <section aria-labelledby="peer-progress-title" className="av-panel mt-6 rounded-2xl p-4 sm:p-5">
      <h2 id="peer-progress-title" className="text-lg font-semibold text-white">
        Your peer speaking
      </h2>
      {empty ? (
        <p className="mt-2 text-sm text-gray-300">
          No sessions yet. After your first session you&apos;ll see your partners&apos; ratings and a next step here.
        </p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 p-3">
              <dt className="text-xs text-gray-400">Sessions this week</dt>
              <dd className="text-2xl font-semibold text-white">{progress.sessionsThisWeek}</dd>
            </div>
            <div className="rounded-xl border border-white/10 p-3">
              <dt className="text-xs text-gray-400">Different partners this month</dt>
              <dd className="text-2xl font-semibold text-white">{progress.partnersThisMonth}</dd>
            </div>
          </dl>
          {progress.received ? (
            <div className="mt-3">
              <p className="text-xs text-gray-400">
                Average rating from partners (last {progress.receivedCount} {progress.receivedCount === 1 ? "session" : "sessions"})
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CRITERIA.map((c) => {
                  const t = progress.trend ? TREND[progress.trend[c]] : null;
                  return (
                    <div key={c} className="rounded-lg border border-white/10 px-3 py-2">
                      <dt className="text-xs text-gray-400">{CRITERION_INFO[c].title}</dt>
                      <dd className="flex items-center gap-1 text-sm font-semibold text-white">
                        {progress.received![c].toFixed(1)}/5
                        {t && (
                          <span className={t.cls}>
                            <t.Icon className="h-4 w-4" aria-hidden />
                            <span className="sr-only">trend {t.label}</span>
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-300">Give feedback after a session to see your partners&apos; ratings for you.</p>
          )}
          {progress.nextStep && (
            <div className="mt-3 rounded-xl border border-averna-cyan/40 bg-averna-cyan/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-averna-cyan">Your next step</p>
              <p className="mt-1 text-sm font-semibold text-white">{progress.nextStep.title}</p>
              <p className="mt-1 text-sm text-gray-200">{progress.nextStep.text}</p>
              <Link
                href={progress.nextStep.href}
                className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10"
              >
                {progress.nextStep.linkLabel} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
