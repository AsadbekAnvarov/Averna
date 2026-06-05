"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarRange, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Printer, Clock } from "lucide-react";

interface Block {
  uid: string;
  label: string;
  emoji: string;
  minutes: number;
}

const PALETTE: { label: string; emoji: string; minutes: number }[] = [
  { label: "Warm-up", emoji: "🔥", minutes: 5 },
  { label: "Homework review", emoji: "📒", minutes: 10 },
  { label: "Vocabulary", emoji: "📖", minutes: 10 },
  { label: "Grammar focus", emoji: "✏️", minutes: 15 },
  { label: "Reading", emoji: "📚", minutes: 20 },
  { label: "Listening", emoji: "🎧", minutes: 15 },
  { label: "Speaking", emoji: "🗣️", minutes: 15 },
  { label: "Writing", emoji: "📝", minutes: 20 },
  { label: "Game / activity", emoji: "🎲", minutes: 10 },
  { label: "Break", emoji: "☕", minutes: 5 },
  { label: "Q&A / wrap-up", emoji: "💬", minutes: 5 },
  { label: "Set homework", emoji: "🎯", minutes: 5 },
];

const KEY = "averna_lesson_plan";

export default function LessonPlannerPage() {
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setTitle(data.title ?? "");
        setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      }
    } catch {}
  }, []);

  const persist = (t: string, b: Block[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ title: t, blocks: b }));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {}
  };

  const add = (p: (typeof PALETTE)[number]) => {
    const next = [...blocks, { uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...p }];
    setBlocks(next);
  };
  const remove = (uid: string) => setBlocks((b) => b.filter((x) => x.uid !== uid));
  const move = (i: number, dir: -1 | 1) => {
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const copy = [...b];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };
  const setMinutes = (uid: string, minutes: number) =>
    setBlocks((b) => b.map((x) => (x.uid === uid ? { ...x, minutes: Math.max(1, minutes) } : x)));

  const total = blocks.reduce((s, b) => s + b.minutes, 0);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl print:py-2">
        <div className="print:hidden">
          <Link href="/teacher/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <CalendarRange className="h-8 w-8 text-averna-cyan" />
            Lesson <span className="neon-text-cyan">Planner</span>
          </h1>
          <p className="text-gray-400 mb-6">
            Build a lesson from ready-made blocks, set timings, reorder, and print. Saved in your browser. 🧩
          </p>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lesson title (e.g. Unit 4 — Travel & Tourism)"
          className="w-full mb-6 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan print:bg-transparent print:border-0 print:text-2xl print:font-bold"
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Palette */}
          <div className="print:hidden">
            <Card className="glass border-averna-purple/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-averna-purple flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add a block
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  {PALETTE.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => add(p)}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:border-averna-purple/40 text-left transition-colors"
                    >
                      <span className="text-lg">{p.emoji}</span>
                      <span className="text-sm text-white flex-1 min-w-0 truncate">{p.label}</span>
                      <span className="text-[10px] text-gray-400">{p.minutes}m</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plan */}
          <div className="lg:col-span-2">
            <Card className="glass border-averna-cyan/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Today&apos;s plan</span>
                  <span className="text-sm font-normal text-averna-cyan flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {total} min
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {blocks.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">
                    Add blocks from the palette to build your lesson.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {blocks.map((b, i) => (
                      <div key={b.uid} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10">
                        <span className="text-lg shrink-0">{b.emoji}</span>
                        <span className="text-sm text-white flex-1 min-w-0 truncate">
                          <span className="text-gray-500 mr-1">{i + 1}.</span>
                          {b.label}
                        </span>
                        <input
                          type="number"
                          value={b.minutes}
                          min={1}
                          onChange={(e) => setMinutes(b.uid, parseInt(e.target.value) || 1)}
                          className="w-14 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-averna-cyan print:border-0"
                        />
                        <span className="text-[10px] text-gray-400 print:hidden">min</span>
                        <div className="flex gap-0.5 print:hidden">
                          <button onClick={() => move(i, -1)} className="p-1 text-gray-400 hover:text-white"><ChevronUp className="h-4 w-4" /></button>
                          <button onClick={() => move(i, 1)} className="p-1 text-gray-400 hover:text-white"><ChevronDown className="h-4 w-4" /></button>
                          <button onClick={() => remove(b.uid)} className="p-1 text-red-300 hover:text-red-200"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-4 print:hidden">
                  <Button onClick={() => persist(title, blocks)} className="neon-button bg-averna-primary hover:bg-averna-light">
                    {saved ? "Saved ✓" : <><Save className="mr-2 h-4 w-4" /> Save</>}
                  </Button>
                  <Button onClick={() => window.print()} variant="outline" className="border-averna-cyan/40 text-averna-cyan">
                    <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
                  {blocks.length > 0 && (
                    <Button onClick={() => setBlocks([])} variant="ghost" className="text-gray-400">
                      <Trash2 className="mr-2 h-4 w-4" /> Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
