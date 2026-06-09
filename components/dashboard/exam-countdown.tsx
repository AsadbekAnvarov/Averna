"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, Save, Pencil } from "lucide-react";

/**
 * Exam countdown + goal. The student sets their IELTS exam date (stored
 * locally); the card shows a motivating "N days to go" and a suggested daily
 * study pace. A clear deadline is one of the strongest, calmest motivators.
 */
export function ExamCountdown() {
  const [date, setDate] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("averna_exam_date") ?? "";
    setDate(saved);
    setEditing(!saved);
    setLoaded(true);
  }, []);

  const save = () => {
    localStorage.setItem("averna_exam_date", date);
    setEditing(false);
  };

  const daysLeft = (() => {
    if (!date) return null;
    const target = new Date(`${date}T00:00:00`);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / 86400000);
  })();

  if (!loaded) return null;

  return (
    <Card className="glass border-averna-pink/30">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-averna-pink mb-3">
          <CalendarClock className="h-5 w-5" />
          <h3 className="font-semibold">Exam Countdown</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="ml-auto text-gray-400 hover:text-white" title="Change date">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">When is your IELTS exam?</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
              />
              <button
                onClick={save}
                disabled={!date}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        ) : daysLeft !== null && daysLeft >= 0 ? (
          <div className="text-center py-2">
            <p className="text-5xl font-bold neon-text-cyan leading-none">{daysLeft}</p>
            <p className="text-sm text-gray-400 mt-1">day{daysLeft === 1 ? "" : "s"} to go</p>
            <p className="text-xs text-gray-500 mt-2">
              {daysLeft === 0
                ? "🎯 It's exam day — you've got this!"
                : daysLeft <= 7
                ? "🔥 Final sprint — review your weak skills daily."
                : "Keep a steady daily routine and you'll be ready."}
            </p>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-gray-400">Your exam date has passed. 🎉 Set a new goal?</p>
            <button onClick={() => setEditing(true)} className="mt-2 text-sm text-averna-pink hover:underline">
              Set a new date
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
