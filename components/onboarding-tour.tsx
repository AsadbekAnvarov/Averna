"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles, PenTool, Mic, Gift, CalendarClock, Zap, X, ChevronRight, ChevronLeft,
} from "lucide-react";

interface Step { icon: any; title: string; text: string; }

const STEPS: Step[] = [
  { icon: Sparkles, title: "Welcome to Averna! 🎉", text: "Let's take a 30-second tour of your new IELTS platform. You can skip anytime." },
  { icon: PenTool, title: "Practise every skill", text: "Writing, Reading, Listening and Speaking — each with instant feedback and an estimated band score." },
  { icon: Mic, title: "Live Speaking practice", text: "During Speaking Time, tap 'Find a Partner' to be paired 1-on-1 with another student and chat on the daily topic." },
  { icon: Zap, title: "Earn points daily", text: "Daily Challenge, homework and tests give you points — but only for genuine effort. Build streaks and climb the rankings!" },
  { icon: CalendarClock, title: "Stay organised", text: "Your Schedule and Calendar show lessons, homework deadlines and attendance in one place." },
  { icon: Gift, title: "Spend your points", text: "Visit the Rewards Store to swap points for trial lessons, discounts and merch. Let's go! 🚀" },
];

const KEY = "averna_onboarding_done_v1";

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      // Show the info tour only after the first-run setup wizard is done, so
      // the two never stack on a brand-new student's first visit.
      const setupDone = localStorage.getItem("averna_setup_done_v1");
      if (!localStorage.getItem(KEY) && setupDone) setOpen(true);
    } catch {}
  }, []);

  const finish = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="glass-strong border border-averna-neon/40 rounded-2xl max-w-md w-full p-6 animate-fade-in relative">
        <button onClick={finish} className="absolute top-3 right-3 text-gray-400 hover:text-white" aria-label="Skip">
          <X className="h-5 w-5" />
        </button>

        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-averna-primary/30 border border-averna-neon/40 flex items-center justify-center">
            <Icon className="h-8 w-8 text-averna-neon" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-2">{s.title}</h2>
        <p className="text-gray-300 text-center mb-6">{s.text}</p>

        {/* progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-averna-neon" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="outline" className="border-white/20" onClick={() => setStep((x) => x - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          ) : (
            <Button variant="ghost" className="text-gray-400" onClick={finish}>Skip</Button>
          )}
          {last ? (
            <Button className="neon-button bg-averna-primary hover:bg-averna-light flex-1 max-w-[60%]" onClick={finish}>
              Start learning 🚀
            </Button>
          ) : (
            <Button className="neon-button bg-averna-primary hover:bg-averna-light" onClick={() => setStep((x) => x + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
