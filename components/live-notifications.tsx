"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

interface Notif { id: string; title: string; message: string; link: string | null; type: string }

/**
 * Polls for unread notifications and shows a toast for any new ones.
 * Also requests browser Notification permission and fires a native
 * notification when the tab is in the background (lightweight push-like UX).
 */
export function LiveNotifications() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Notif[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const firstRun = useRef(true);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      // Ask politely, once
      Notification.requestPermission().catch(() => {});
    }

    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/notifications/recent");
        if (!res.ok) return;
        const data = await res.json();
        const items: Notif[] = data.items ?? [];

        if (firstRun.current) {
          // Seed seen set without toasting the backlog
          items.forEach((n) => seen.current.add(n.id));
          firstRun.current = false;
          return;
        }

        const fresh = items.filter((n) => !seen.current.has(n.id));
        fresh.forEach((n) => seen.current.add(n.id));
        if (fresh.length > 0) {
          setToasts((t) => [...fresh, ...t].slice(0, 4));
          // Native notification when tab hidden
          if (typeof document !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
            fresh.forEach((n) => {
              try { new Notification(n.title, { body: n.message, icon: "/logo.png" }); } catch {}
            });
          }
          // Auto-dismiss toasts after 6s
          fresh.forEach((n) => {
            setTimeout(() => {
              if (active) setToasts((t) => t.filter((x) => x.id !== n.id));
            }, 6000);
          });
        }
      } catch {}
    };

    poll();
    const id = setInterval(poll, 20000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));
  const open = (n: Notif) => { dismiss(n.id); if (n.link) router.push(n.link); };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[120] space-y-2 w-[88vw] max-w-sm">
      {toasts.map((n) => (
        <div
          key={n.id}
          className="glass-strong border border-averna-neon/40 rounded-xl p-3 shadow-neon-green animate-fade-in flex items-start gap-3 cursor-pointer"
          onClick={() => open(n)}
        >
          <Bell className="h-5 w-5 text-averna-neon shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{n.title}</p>
            <p className="text-gray-300 text-xs">{n.message}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} className="text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
