"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Wand2, Loader2, Copy, RotateCcw } from "lucide-react";

interface LessonPlan {
  topic: string;
  level: string;
  objectives: string[];
  warmup: string;
  presentation: string[];
  examples: string[];
  exercises: string[];
  speaking: string[];
  writingPrompt: string;
  vocabulary: string[];
  homework: string;
  quiz: { q: string; a: string }[];
  differentiation: { stronger: string; weaker: string };
}

const LEVELS = ["A1–A2", "B1–B2", "C1–C2"];

function toText(p: LessonPlan): string {
  const list = (a: string[]) => a.map((x) => `  • ${x}`).join("\n");
  return [
    `LESSON PLAN — ${p.topic} (${p.level})`,
    ``,
    `Objectives:\n${list(p.objectives)}`,
    ``,
    `Warm-up:\n  ${p.warmup}`,
    ``,
    `Presentation:\n${list(p.presentation)}`,
    ``,
    `Examples:\n${list(p.examples)}`,
    ``,
    `Exercises:\n${list(p.exercises)}`,
    ``,
    `Speaking:\n${list(p.speaking)}`,
    ``,
    `Writing prompt:\n  ${p.writingPrompt}`,
    ``,
    `Vocabulary: ${p.vocabulary.join(", ")}`,
    ``,
    `Homework:\n  ${p.homework}`,
    ``,
    `Quiz:\n${p.quiz.map((q, i) => `  ${i + 1}. ${q.q}\n     → ${q.a}`).join("\n")}`,
    ``,
    `Differentiation:\n  Stronger: ${p.differentiation.stronger}\n  Weaker: ${p.differentiation.weaker}`,
  ].join("\n");
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">{title}</p>
      <ul className="space-y-1">
        {items.map((x, i) => (
          <li key={i} className="text-sm text-gray-300 flex gap-2">
            <span className="text-averna-purple mt-1.5 h-1 w-1 rounded-full bg-averna-purple shrink-0" /> {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * F2 — AI Lesson Builder. Enter a topic and get a complete, classroom-ready
 * offline lesson (objectives, warm-up, presentation, examples, exercises,
 * speaking, writing, vocabulary, homework, quiz, differentiation). GPT-4o with a
 * templated fallback; copy it into your Lesson Log and adapt.
 */
export function LessonBuilder() {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("B1–B2");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<LessonPlan | null>(null);

  const build = async () => {
    if (topic.trim().length < 2) {
      toast.error("Enter a topic, e.g. “Passive Voice”.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/lesson-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlan(data as LessonPlan);
    } catch (e: any) {
      toast.error(e.message || "Couldn't build the lesson.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(toText(plan));
      toast.success("Lesson copied — paste it into your Lesson Log.");
    } catch {
      toast.error("Couldn't copy.");
    }
  };

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-purple">
          <Wand2 className="h-5 w-5" /> AI Lesson Builder
        </CardTitle>
        <p className="text-xs text-gray-400">Type a topic — get a full, editable offline lesson in seconds</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!plan ? (
          <>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && build()}
              placeholder="Today's topic — e.g. Passive Voice, Cause & Effect essays…"
              className="bg-background/50"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Level:</span>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition ${
                    level === l ? "border-averna-purple/60 bg-averna-purple/20 text-averna-purple" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
              <Button onClick={build} disabled={loading} className="ml-auto neon-button bg-averna-purple hover:bg-averna-purple/80 text-white">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {loading ? "Building…" : "Build lesson"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-white">{plan.topic}</p>
                <p className="text-[11px] text-gray-500">Level {plan.level} · editable draft</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={copy} variant="outline" className="border-averna-purple/40 text-averna-purple">
                  <Copy className="mr-1.5 h-4 w-4" /> Copy
                </Button>
                <Button onClick={() => setPlan(null)} variant="outline" className="border-white/20">
                  <RotateCcw className="mr-1.5 h-4 w-4" /> New
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Section title="Objectives" items={plan.objectives} />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">Warm-up</p>
                <p className="text-sm text-gray-300">{plan.warmup}</p>
              </div>
              <Section title="Presentation" items={plan.presentation} />
              <Section title="Examples" items={plan.examples} />
              <Section title="Exercises" items={plan.exercises} />
              <Section title="Speaking" items={plan.speaking} />
              <div>
                <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">Writing prompt</p>
                <p className="text-sm text-gray-300">{plan.writingPrompt}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">Vocabulary</p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.vocabulary.map((v) => (
                    <span key={v} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">{v}</span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">Homework</p>
              <p className="text-sm text-gray-300">{plan.homework}</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1">Quick quiz</p>
              <ul className="space-y-1.5">
                {plan.quiz.map((q, i) => (
                  <li key={i} className="text-sm text-gray-300">
                    <span className="text-white">{i + 1}. {q.q}</span>
                    <span className="block text-[11px] text-gray-500">→ {q.a}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-averna-neon/30 bg-averna-neon/5 p-3">
                <p className="text-[11px] uppercase tracking-wider text-averna-neon mb-1">Stronger students</p>
                <p className="text-sm text-gray-300">{plan.differentiation.stronger}</p>
              </div>
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                <p className="text-[11px] uppercase tracking-wider text-amber-300 mb-1">Weaker students</p>
                <p className="text-sm text-gray-300">{plan.differentiation.weaker}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
