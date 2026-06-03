import Link from "next/link";
import { Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Async server component: shows a bell with the current user's unread
 * notification count. Links to /notifications.
 */
export async function NotificationBell() {
  const session = await auth();
  let unread = 0;
  if (session?.user) {
    try {
      unread = await db.notification.count({
        where: { userId: session.user.id, read: false },
      });
    } catch {
      unread = 0;
    }
  }

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-averna-primary/20 transition-colors"
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5 text-gray-300" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
