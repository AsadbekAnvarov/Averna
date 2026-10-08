"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, Pause, Play } from "lucide-react";
import type { FocusPlan } from "@/lib/study/next-session";
import { Button } from "@/components/ui/button";

export function FocusSession({ plan }: { plan: FocusPlan }) {
  const [active, setActive] = useState(0);
  const [seconds, setSeconds] = useState(plan.steps[0].minutes * 60);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  // No points or verified learning events are awarded for a checklist or a timer.
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) setDeadline(null);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadline]);
  const step = plan.steps[active];
  const advance = () => {
    setDeadline(null);
    if (active === plan.steps.length - 1) {
      setDone(true);
      return;
    }
    setActive(active + 1);
    setSeconds(plan.steps[active + 1].minutes * 60);
  };
  return (
    <section
      aria-labelledby="focus-title"
      className="rounded-2xl border border-averna-cyan/25 bg-white/5 p-5 sm:p-8"
    >
      <p className="text-sm font-medium text-study-ink">
        {plan.personalised
          ? "Grounded in your Learning DNA"
          : "A balanced starting session"}
      </p>
      <h1
        id="focus-title"
        className="mt-3 text-3xl sm:text-4xl font-semibold text-white"
      >
        {done ? "One focused session. One next step." : plan.title}
      </h1>
      <p className="mt-4 max-w-2xl text-base text-gray-300">{plan.basis}</p>
      <ol className="grid gap-3 mt-7 sm:grid-cols-3" aria-label="Session steps">
        {plan.steps.map((s, i) => (
          <li
            key={s.id}
            className={`rounded-xl border p-4 ${i === active && !done ? "border-averna-cyan/50 bg-averna-cyan/5" : "border-white/15"}`}
          >
            <p className="flex items-center gap-2 text-sm text-gray-300">
              {i < active || done ? (
                <Check
                  className="h-4 w-4 text-study-ink"
                  aria-label="Marked as practised"
                />
              ) : (
                <span>{i + 1}</span>
              )}
              <span>{s.minutes} min</span>
            </p>
            <h2 className="mt-2 font-medium text-white">{s.title}</h2>
            <p className="mt-2 text-sm text-gray-300">{s.why}</p>
          </li>
        ))}
      </ol>
      {done ? (
        <div role="status" className="mt-7">
          <p className="text-gray-300">
            You marked these steps as practised. Actual exercises and saved
            corrections remain the source of your learning progress — the timer
            itself earns no XP.
          </p>
          <a
            href="/progress"
            className="inline-flex min-h-11 items-center gap-2 mt-5 text-study-ink"
          >
            See your learning progress <ArrowRight className="h-4 w-4" />
          </a>
          <Button
            variant="outline"
            className="ml-4 min-h-11"
            onClick={() => {
              setActive(0);
              setSeconds(plan.steps[0].minutes * 60);
              setDone(false);
            }}
          >
            Plan another session
          </Button>
        </div>
      ) : (
        <div className="mt-7 rounded-xl border border-white/15 p-5">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <p className="text-sm text-gray-400">
                Step {active + 1} of {plan.steps.length}
              </p>
              <h3 className="mt-1 text-xl font-medium text-white">
                {step.title}
              </h3>
            </div>
            <div
              className="flex items-center gap-2 text-2xl tabular-nums text-white"
              aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`}
            >
              <Clock3 className="h-5 w-5 text-study-ink" />
              <span>
                {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                {String(seconds % 60).padStart(2, "0")}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-300">
            Open the exercise in a new tab, then return here when you are ready.
            The timer is a guide, not an exam limit.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <a
              href={step.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-averna-cyan/15 border border-averna-cyan/40 px-4 text-sm font-medium text-study-ink"
            >
              Open exercise <ArrowRight className="h-4 w-4" />
            </a>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() =>
                deadline
                  ? setDeadline(null)
                  : setDeadline(Date.now() + seconds * 1000)
              }
              disabled={seconds === 0}
            >
              {deadline ? (
                <Pause className="mr-2 h-4 w-4" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {deadline ? "Pause timer" : "Start timer"}
            </Button>
            <Button variant="outline" className="min-h-11" onClick={advance}>
              I practised this step <Check className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {seconds === 0 && (
            <p role="status" className="mt-3 text-sm text-study-ink">
              Suggested time is up. Finish at your own pace, then move on.
            </p>
          )}
        </div>
      )}
      <p className="mt-5 text-sm text-gray-400">
        This guide stays in this tab. Your exercises save to your signed-in
        account.
      </p>
    </section>
  );
}
