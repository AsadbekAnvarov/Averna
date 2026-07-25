"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { NotebookPen, Loader2, Sparkles, ArrowRight, ListChecks, RefreshCw } from "lucide-react";

interface Lesson {
  id: string;
  topic: string;
  notes: string | null;
  date: string;
  group: string;
  weakArea: string | null;
}
interface Reflection {
  summary: string[];
  nextSuggestions: string[];
  reviewActivities: string[];
}

/**
 * F4 — Lesson Reflection Center. Pick a recorded lesson and the AI writes a
 * post-lesson reflection: what to note, what to do next, and review activities
 * — grounded in the lesson notes and the group's weakest skill. GPT-4o with a
 * templated fallback.
 */
export function LessonReflection({ lessons }: { lessons: Lesson[] }) {
  const [selected, setSelected] = useState<Lesson | null>(lessons[0] ?? null);
  const [loading, setLoading] = useState(false);
  const [r, setR] = useState<Reflection | null>(null);

  const generate = async (lesson: Lesson) => {
    setSelected(lesson);
    setR(null);
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: lesson.topic, notes: lesson.notes, weakArea: lesson.weakArea, groupName: lesson.group }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setR(data as Reflection);
    } catch (e: any) {
      toast.error(e.message || "Couldn't generate reflection.");
    } finally {
      setLoading(false);
    }
  };

  if (lessons.length === 0) {
    return (
      <Card className="glass border-averna-blue/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-blue">
            <NotebookPen className="h-5 w-5" /> Lesson Reflection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 py-3">
            Log a lesson in your Lesson Log and the AI will write a reflection with next-step suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-averna-blue/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-blue">
          <NotebookPen className="h-5 w-5" /> Lesson Reflection
        </CardTitle>
        <p className="text-xs text-gray-400">Pick a lesson — the AI reflects and suggests what's next</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lessons.map((l) => (
            <button
              key={l.id}
              onClick={() => generate(l)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-left transition-colors ${
                selected?.id === l.id ? "border-averna-blue/60 bg-averna-blue/15" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="block text-xs font-medium text-white truncate max-w-[160px]">{l.topic}</span>
              <span className="block text-[10px] text-gray-500">{l.group} · {l.date}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-averna-blue py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Reflecting on the lesson…
          </div>
        ) : r ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-averna-blue mb-1 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> What happened</p>
              <ul className="space-y-1">{r.summary.map((s, i) => <li key={i} className="text-sm text-gray-300">• {s}</li>)}</ul>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-averna-neon mb-1 flex items-center gap-1"><ArrowRight className="h-3.5 w-3.5" /> Next lesson</p>
              <ul className="space-y-1">{r.nextSuggestions.map((s, i) => <li key={i} className="text-sm text-gray-300">• {s}</li>)}</ul>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-averna-purple mb-1 flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Review activities</p>
              <ul className="space-y-1">{r.reviewActivities.map((s, i) => <li key={i} className="text-sm text-gray-300">• {s}</li>)}</ul>
            </div>
          </div>
        ) : (
          <Button onClick={() => selected && generate(selected)} className="neon-button bg-averna-blue hover:bg-averna-blue/80 text-white">
            <RefreshCw className="mr-2 h-4 w-4" /> Reflect on “{selected?.topic}”
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
