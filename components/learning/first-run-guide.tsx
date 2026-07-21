import Link from "next/link";
import { Rocket, ClipboardCheck, TrendingUp, Sparkles, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: ClipboardCheck, title: "Take a baseline test", text: "A short mock exam sets your starting band." },
  { icon: TrendingUp, title: "Build your Skill Journey", text: "Each skill fills in with your level and next step." },
  { icon: Sparkles, title: "Get a personal plan", text: "We recommend exactly what to study next." },
];

/**
 * Contextual first-run guide shown on the Learning Center while a student has
 * not completed any test yet. Unlike the one-time welcome tour, this stays put
 * until the student takes a baseline exam, turning a page full of "Not started"
 * into one obvious first action — the single biggest driver of activation.
 */
export function FirstRunGuide({ name }: { name?: string | null }) {
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-averna-neon/30 glass-strong p-6 mb-8">
      {/* decorative glow */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-averna-neon/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Rocket className="h-5 w-5 text-averna-neon" />
          <span className="text-xs uppercase tracking-wider text-averna-neon font-semibold">Get started</span>
        </div>

        <h2 className="text-2xl font-bold text-white">
          {firstName ? `Welcome, ${firstName}!` : "Welcome to Averna!"} Let&apos;s find your starting band 🎯
        </h2>
        <p className="text-gray-300 mt-1 mb-5 max-w-xl">
          You haven&apos;t taken a test yet. Start with a quick baseline mock exam so we can map your level and build a personalised study plan.
        </p>

        <ol className="grid sm:grid-cols-3 gap-3 mb-5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-averna-neon/20 text-averna-neon text-xs font-bold">
                    {i + 1}
                  </span>
                  <Icon className="h-4 w-4 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.text}</p>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/learning/mock-exam"
            className="inline-flex items-center gap-2 rounded-xl bg-averna-primary hover:bg-averna-light text-white px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Take your baseline test
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/flashcards" className="text-sm text-gray-400 hover:text-white transition-colors">
            Or warm up with vocabulary →
          </Link>
        </div>
      </div>
    </div>
  );
}
