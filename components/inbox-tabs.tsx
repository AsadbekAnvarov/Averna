"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Bell } from "lucide-react";

/**
 * Shared tab strip that unifies Messages and Notifications into one "Inbox".
 * Highlights the active page and shows unread counts.
 */
export function InboxTabs({
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  unreadMessages?: number;
  unreadNotifications?: number;
}) {
  const pathname = usePathname() ?? "";
  const tabs = [
    { href: "/messages", label: "Messages", icon: MessageSquare, badge: unreadMessages, active: pathname.startsWith("/messages") },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: unreadNotifications, active: pathname.startsWith("/notifications") },
  ];
  return (
    <div className="inline-flex gap-1 glass-strong border border-white/10 rounded-2xl p-1.5 mb-6">
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              t.active ? "bg-averna-primary text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
            {t.badge > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-averna-pink text-white">{t.badge}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
