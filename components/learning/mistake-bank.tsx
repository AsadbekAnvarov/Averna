"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { BookMarked, Plus, RotateCcw, Trash2, CheckCircle2, Sparkles, PartyPopper } from "lucide-react";
import { schedule, isDue, intervalHint, type Rating, type SrsCardState } from "@/lib/srs";

const STORAGE_KEY = "averna_mistakes_v1";

interface Mistake {
  id: string;
  wrong: string;
  right: string;
  note?: string;
  srs?: SrsCardState;
}

/**
 * Mistake Bank — students log their mistakes (wrong → correct + why) and the
 * app schedules them with spaced repetition, resurfacing each one right before
 * it's forgotten. Turns error remediation into a systematic, satisfying habit.
 * Fully client-side; reuses the SRS engine from lib/srs.ts.
 */
export function MistakeBank() {
  const [items, setItems] = useState<Mistake[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"review" | "add">("review");

  // Review session
  const [queue, setQueue] = useState<Mistake[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const started = useRef(false);

  // Add form
  const [wrong, setWrong] = useState("");
  const [right, setRight] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const persist = (list: Mistake[]) => {
    setItems(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const dueCount = useMemo(() => items.filter((m) => isDue(m.srs)).length, [items]);

  const startReview = () => {
    const due = items.filter((m) => isDue(m.srs)).sort(() => Math.random() - 0.5);
    setQueue(due);
    setRevealed(false);
    setReviewed(0);
    started.current = true;
  };

  const current = queue[0];

  const rate = (rating: Rating) => {
    if (!current) return;
    const nextSrs = schedule(current.srs, rating);
    const updated = items.map((m) => (m.id === current.id ? { ...m, srs: nextSrs } : m));
    persist(updated);
    setReviewed((n) => n + 1);
    setRevealed(false);
    setQueue((q) => {
      const [, ...rest] = q;
      return rating === "again" ? [...rest, { ...current, srs: nextSrs }] : rest;
    });
  };

  const addMistake = () => {
    if (!wrong.trim() || !right.trim()) {
      toast.error("Enter both the mistake and the correction.");
      return;
    }
    const item: Mistake = { id: `m-${Date.now()}`, wrong: wrong.trim(), right: right.trim(), note: note.trim() || undefined };
    persist([item, ...items]);
    setWrong(""); setRight(""); setNote("");
    toast.success("Added — it'll come back for review at the right time. 🧠");
  };

  const remove = (id: string) => persist(items.filter((m) => m.id !== id));

  const ratings: { key: Rating; label: string; cls: string }[] = [
    { key: "again", label: "Again", cls: "border-red-500/50 text-red-300 hover:bg-red-500/10" },
    { key: "hard", label: "Hard", cls: "border-amber-500/50 text-amber-300 hover:bg-amber-500/10" },
    { key: "good", label: "Good", cls: "border-averna-cyan/50 text-averna-cyan hover:bg-averna-cyan/10" },
    { key: "easy", label: "Easy", cls: "border-averna-neon/50 text-averna-neon hover:bg-averna-neon/10" },
  ];

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-cyan">
          <span className="flex items-center gap-2"><BookMarked className="h-5 w-5" /> Mistake Bank</span>
          {loaded && <span className="text-xs font-normal text-gray-400">{items.length} saved · {dueCount} due</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="inline-flex rounded-lg border border-white/10 p-0.5 bg-white/5">
          <button
            onClick={() => { setTab("review"); startReview(); }}
            className={`px-3 py-1.5 text-sm rounded-md transition ${tab === "review" ? "bg-averna-cyan/20 text-averna-cyan" : "text-gray-400 hover:text-white"}`}
          >
            Review{dueCount > 0 ? ` (${dueCount})` : ""}
          </button>
          <button
            onClick={() => setTab("add")}
            className={`px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1.5 ${tab === "add" ? "bg-averna-cyan/20 text-averna-cyan" : "text-gray-400 hover:text-white"}`}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {tab === "add" ? (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-gray-400">Your mistake (what you wrote/said)</label>
              <Input value={wrong} onChange={(e) => setWrong(e.target.value)} placeholder="e.g. I have went to London" className="bg-background/50" />
            </div>
            <div>
              <label className="text-[11px] text-gray-400">The correction</label>
              <Input value={right} onChange={(e) => setRight(e.target.value)} placeholder="e.g. I have been to London" className="bg-background/50" />
            </div>
            <div>
              <label className="text-[11px] text-gray-400">Why / rule (optional)</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. present perfect uses the past participle 'been'" className="bg-background/50" />
            </div>
            <Button onClick={addMistake} className="w-full neon-button bg-averna-cyan hover:bg-averna-cyan/80 text-black">
              <Plus className="mr-2 h-4 w-4" /> Add to bank
            </Button>

            {items.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {items.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-xs rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-red-300 line-through">{m.wrong}</span>{" "}
                      <span className="text-averna-neon">{m.right}</span>
                    </span>
                    <button onClick={() => remove(m.id)} aria-label="Delete" className="text-gray-500 hover:text-red-400 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-averna-cyan" />
            No mistakes saved yet. Add ones you make in Writing, Speaking or tests — the app will help you never repeat them.
          </div>
        ) : !current ? (
          <div className="text-center py-8">
            <PartyPopper className="h-10 w-10 text-averna-neon mx-auto mb-3" />
            <p className="text-white font-semibold">Nothing due right now! 🎉</p>
            <p className="text-sm text-gray-400 mt-1">
              {reviewed > 0 ? `You reviewed ${reviewed} mistake${reviewed === 1 ? "" : "s"}.` : "Your mistakes come back on schedule — check back later."}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs text-gray-400">
              <span>{queue.length} due</span>
              <span className="flex items-center gap-1 text-averna-neon"><RotateCcw className="h-3.5 w-3.5" /> {reviewed} reviewed</span>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
              <p className="text-[11px] uppercase tracking-wider text-averna-cyan mb-2">Correct this</p>
              <p className="text-lg text-red-300 line-through">{current.wrong}</p>
              {revealed ? (
                <div className="mt-4 animate-fade-in">
                  <p className="text-xl font-semibold text-averna-neon">{current.right}</p>
                  {current.note && <p className="text-sm text-gray-300 mt-2">{current.note}</p>}
                </div>
              ) : (
                <Button onClick={() => setRevealed(true)} variant="outline" className="mt-4 border-averna-neon/40 text-averna-neon">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Show correction
                </Button>
              )}
            </div>

            {revealed && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {ratings.map((r) => (
                  <button key={r.key} onClick={() => rate(r.key)} className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg border bg-white/5 transition-colors ${r.cls}`}>
                    <span className="text-sm font-medium">{r.label}</span>
                    <span className="text-[10px] opacity-70">{intervalHint(current.srs, r.key)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
