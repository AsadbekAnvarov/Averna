"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Small live clock that always shows Tashkent (UTC+5) time, regardless of
 * the user's device timezone — so everyone at the centre sees the same time.
 */
export function TashkentClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Tashkent",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };
    update();
    const id = setInterval(update, 1000 * 20);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <span
      className="hidden md:inline-flex items-center gap-1 text-xs text-gray-400 px-2 py-1 rounded-md border border-white/10"
      title="Tashkent time (UTC+5)"
    >
      <Clock className="h-3.5 w-3.5 text-averna-cyan" />
      {time} <span className="text-gray-500">Tashkent</span>
    </span>
  );
}
