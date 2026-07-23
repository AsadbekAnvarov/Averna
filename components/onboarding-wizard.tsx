"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, GraduationCap, CalendarClock, Check, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

const SETUP_KEY = "averna_setup_done_v1";
const EXAM_KEY = "averna_exam_date";

const GOALS = [
  { value: "IELTS 7.5+", emoji: "🎯", hint: "Hit a high band" },
  { value: "Study Abroad", emoji: "🎓", hint: "University admission" },
  { value: "Work Opportunities", emoji: "💼", hint: "Career & jobs" },
  { value: "Immigration", emoji: "✈️", hint: "Move abroad" },
  { value: "Personal Development", emoji: "🌱", hint: "Improve my English" },
];

const BANDS = ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5+"];

/**
 * First-run setup wizard for new students: collects their goal, target band and
 * exam date so the whole dashboard is personalised from the very first visit.
 * Runs BEFORE the info tour (which is gated on the same setup flag), so the two
 * never overlap. Auto-skips (and marks setup done) for students who already
 * have a target band / goal.
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [band, setBand] = useState("");
  const [examDate, setExamDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const decide = async () => {
      try {
        if (localStorage.getItem(SETUP_KEY)) return;
        // Skip (and remember) if the student already set up their profile.
        const res = await fetch("/api/profile");
        if (res.ok) {
          const p = await res.json();
          if ((p.targetBand && p.targetBand.trim()) || (p.personalGoal && p.personalGoal.trim())) {
            localStorage.setItem(SETUP_KEY, "1");
            return;
          }
          if (!cancelled) {
            if (p.targetBand) setBand(p.targetBand);
            if (p.personalGoal) setGoal(p.personalGoal);
          }
        }
        const savedExam = localStorage.getItem(EXAM_KEY);
        if (savedExam && !cancelled) setExamDate(savedExam);
        if (!cancelled) setOpen(true);
      } catch {
        /* offline / no profile — don't block the dashboard */
      }
    };

    let cleanup: (() => void) | undefined;
    try {
      // If the welcome tour is already done, decide now; otherwise wait until it
      // finishes so the two never overlap and the wizard follows the tour.
      if (localStorage.getItem("averna_onboarding_done_v1")) {
        decide();
      } else {
        const onTourDone = () => decide();
        window.addEventListener("averna-tour-finished", onTourDone, { once: true });
        cleanup = () => window.removeEventListener("averna-tour-finished", onTourDone);
      }
    } catch {
      decide();
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const done = (persist: boolean) => {
    try {
      localStorage.setItem(SETUP_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
    if (persist) router.refresh();
  };

  const finish = async () => {
    setSaving(true);
    try {
      if (examDate) {
        try {
          localStorage.setItem(EXAM_KEY, examDate);
        } catch {
          /* ignore */
        }
      }
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalGoal: goal || undefined, targetBand: band || undefined }),
      });
    } catch {
      /* best-effort — still finish so the student isn't stuck */
    } finally {
      setSaving(false);
      done(true);
    }
  };

  if (!open) return null;

  const steps = [
    // 0 — welcome
    <div key="w" className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-averna-primary/30 border border-averna-neon/40">
        <Sparkles className="h-8 w-8 text-averna-neon" />
      </div>
      <h2 className="text-2xl font-bold text-white">Let&apos;s set up Averna for you</h2>
      <p className="text-gray-300 mt-2">Three quick questions so your dashboard, plan and reminders fit your goal. Takes ~20 seconds.</p>
    </div>,

    // 1 — goal
    <div key="g">
      <div className="flex items-center gap-2 text-averna-purple mb-3"><Target className="h-5 w-5" /><h3 className="font-semibold">What&apos;s your main goal?</h3></div>
      <div className="grid gap-2">
        {GOALS.map((g) => (
          <button
            key={g.value}
            onClick={() => setGoal(g.value)}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
              goal === g.value ? "border-averna-neon bg-averna-neon/10" : "border-white/10 bg-white/5 hover:border-white/25"
            }`}
          >
            <span className="text-2xl">{g.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-white">{g.value}</span>
              <span className="block text-xs text-gray-400">{g.hint}</span>
            </span>
            {goal === g.value && <Check className="h-4 w-4 text-averna-neon shrink-0" />}
          </button>
        ))}
      </div>
    </div>,

    // 2 — target band
    <div key="b">
      <div className="flex items-center gap-2 text-averna-cyan mb-3"><GraduationCap className="h-5 w-5" /><h3 className="font-semibold">Your target IELTS band?</h3></div>
      <div className="grid grid-cols-4 gap-2">
        {BANDS.map((b) => (
          <button
            key={b}
            onClick={() => setBand(b)}
            className={`py-3 rounded-xl border text-sm font-semibold transition-colors ${
              band === b ? "border-averna-cyan bg-averna-cyan/15 text-averna-cyan" : "border-white/10 bg-white/5 text-gray-200 hover:border-averna-cyan/40"
            }`}
          >
            {b}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">We&apos;ll track your progress toward this band across every skill.</p>
    </div>,

    // 3 — exam date
    <div key="d">
      <div className="flex items-center gap-2 text-averna-pink mb-3"><CalendarClock className="h-5 w-5" /><h3 className="font-semibold">When is your exam?</h3></div>
      <input
        type="date"
        value={examDate}
        onChange={(e) => setExamDate(e.target.value)}
        className="w-full rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
      />
      <p className="text-xs text-gray-500 mt-3">
        Optional — powers your Exam Countdown and daily pace. You can set or change it anytime.
      </p>
    </div>,
  ];

  const last = step === steps.length - 1;
  const canNext = step === 1 ? !!goal : step === 2 ? !!band : true;

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="glass-strong border border-averna-neon/40 rounded-2xl max-w-md w-full p-6 animate-pop-in relative">
        {steps[step]}

        {/* progress dots */}
        <div className="flex justify-center gap-1.5 my-6">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-averna-neon" : "w-1.5 bg-white/20"}`} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="outline" className="border-white/20" onClick={() => setStep((x) => x - 1)} disabled={saving}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : (
            <Button variant="ghost" className="text-gray-400" onClick={() => done(false)} disabled={saving}>
              Skip
            </Button>
          )}
          {last ? (
            <Button className="neon-button bg-averna-primary hover:bg-averna-light flex-1 max-w-[60%]" onClick={finish} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <>Finish 🚀</>}
            </Button>
          ) : (
            <Button className="neon-button bg-averna-primary hover:bg-averna-light" onClick={() => setStep((x) => x + 1)} disabled={!canNext}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
