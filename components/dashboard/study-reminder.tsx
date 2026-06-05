"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, BellRing, BellOff } from "lucide-react";

interface StudyReminderProps {
  xpEarnedToday: number;
  dailyGoal?: number;
}

const KEY_ENABLED = "averna_reminder_enabled";
const KEY_TIME = "averna_reminder_time";

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function StudyReminder({ xpEarnedToday, dailyGoal = 100 }: StudyReminderProps) {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("18:00");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const firedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setSupported(false);
      return;
    }
    setPermission(Notification.permission);
    try {
      setEnabled(localStorage.getItem(KEY_ENABLED) === "1");
      const t = localStorage.getItem(KEY_TIME);
      if (t) setTime(t);
    } catch {}
  }, []);

  const goalMet = xpEarnedToday >= dailyGoal;

  // Check every 30s whether it's time to nudge (only while the app is open).
  const maybeNotify = useCallback(() => {
    if (!enabled || permission !== "granted" || goalMet || firedRef.current) return;
    const [h, m] = time.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h || 18, m || 0, 0, 0);
    if (now < target) return;

    let last = "";
    try {
      last = localStorage.getItem("averna_reminded_on") ?? "";
    } catch {}
    if (last === todayStamp()) {
      firedRef.current = true;
      return;
    }

    try {
      new Notification("Time to study on Averna 📚", {
        body: `You're ${dailyGoal - xpEarnedToday} XP away from today's goal. A few minutes counts!`,
        icon: "/icon-192.png",
      });
      localStorage.setItem("averna_reminded_on", todayStamp());
      firedRef.current = true;
    } catch {}
  }, [enabled, permission, goalMet, time, xpEarnedToday, dailyGoal]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    maybeNotify();
    const id = setInterval(maybeNotify, 30000);
    return () => clearInterval(id);
  }, [enabled, permission, maybeNotify]);

  const toggle = async () => {
    if (!enabled) {
      let perm = permission;
      if (perm !== "granted") {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }
      if (perm === "granted") {
        setEnabled(true);
        try {
          localStorage.setItem(KEY_ENABLED, "1");
        } catch {}
      }
    } else {
      setEnabled(false);
      try {
        localStorage.setItem(KEY_ENABLED, "0");
      } catch {}
    }
  };

  const onTimeChange = (v: string) => {
    setTime(v);
    firedRef.current = false;
    try {
      localStorage.setItem(KEY_TIME, v);
    } catch {}
  };

  if (!supported) return null;

  const active = enabled && permission === "granted";

  return (
    <Card className={`glass ${active ? "border-averna-cyan/40" : "border-white/10"}`}>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              active ? "bg-averna-cyan/15 border-averna-cyan/30" : "bg-white/5 border-white/10"
            }`}
          >
            {active ? (
              <BellRing className="h-5 w-5 text-averna-cyan" />
            ) : (
              <Bell className="h-5 w-5 text-gray-400" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Daily Study Reminder</p>
            <p className="text-xs text-gray-400">
              {active ? "On — we'll nudge you while Averna is open." : "Get a gentle daily nudge to keep your streak."}
            </p>
          </div>
          <button
            onClick={toggle}
            className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
              active ? "bg-averna-cyan" : "bg-white/15"
            }`}
            aria-label="Toggle reminder"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                active ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {active && (
          <div className="flex items-center gap-2 mt-3 pl-1">
            <span className="text-xs text-gray-400">Remind me at</span>
            <input
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
            />
            {goalMet && <span className="text-xs text-averna-neon">🎉 goal done today</span>}
          </div>
        )}

        {permission === "denied" && (
          <p className="text-[11px] text-orange-300 mt-2">
            Notifications are blocked in your browser settings — enable them to use reminders.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
