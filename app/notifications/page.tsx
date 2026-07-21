export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell, CheckCheck, BookMarked, Award, CalendarClock, MessageSquare, Info } from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import { InboxTabs } from "@/components/inbox-tabs";

async function markAllRead() {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  await db.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}

function iconFor(type: string) {
  switch (type) {
    case "homework": return <BookMarked className="h-5 w-5 text-purple-400" />;
    case "grade": return <Award className="h-5 w-5 text-averna-neon" />;
    case "booking": return <CalendarClock className="h-5 w-5 text-averna-cyan" />;
    case "message": return <MessageSquare className="h-5 w-5 text-averna-pink" />;
    default: return <Info className="h-5 w-5 text-gray-400" />;
  }
}

function homeHref(role: string | undefined) {
  if (role === "TEACHER") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/dashboard";
}

const TYPES = [
  { key: "all", label: "All" },
  { key: "homework", label: "Homework" },
  { key: "grade", label: "Grades" },
  { key: "message", label: "Messages" },
  { key: "booking", label: "Bookings" },
  { key: "system", label: "System" },
];

function bucketOf(date: Date): "Today" | "This week" | "Earlier" {
  const diff = Date.now() - new Date(date).getTime();
  const days = diff / 86400000;
  if (days < 1 && new Date(date).getDate() === new Date().getDate()) return "Today";
  if (days < 7) return "This week";
  return "Earlier";
}

export default async function NotificationsPage({ searchParams }: { searchParams: { type?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const typeFilter = searchParams.type && searchParams.type !== "all" ? searchParams.type : null;

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id, ...(typeFilter ? { type: typeFilter } : {}) },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const unreadCount = await db.notification.count({ where: { userId: session.user.id, read: false } });
  const unreadMessages = await db.message.count({ where: { receiverId: session.user.id, read: false } });

  // Group into time buckets, preserving order
  const buckets: Record<string, typeof notifications> = { Today: [], "This week": [], Earlier: [] };
  for (const n of notifications) buckets[bucketOf(n.createdAt)].push(n);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <Link href={homeHref(session.user.role)} className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>

        <InboxTabs unreadMessages={unreadMessages} unreadNotifications={unreadCount} />
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Bell className="h-8 w-8 text-averna-cyan" />
            Notifications
            {unreadCount > 0 && (
              <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-averna-pink/20 text-averna-pink">{unreadCount} new</span>
            )}
          </h1>
          {unreadCount > 0 && (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" size="sm" className="border-averna-neon text-averna-neon">
                <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
              </Button>
            </form>
          )}
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TYPES.map((t) => {
            const active = (searchParams.type ?? "all") === t.key;
            return (
              <Link key={t.key} href={t.key === "all" ? "/notifications" : `/notifications?type=${t.key}`}>
                <span className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active ? "bg-averna-primary text-white border-averna-neon" : "bg-white/5 border-white/10 text-gray-300 hover:border-averna-cyan/40"
                }`}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>

        {notifications.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-2">
              <EmptyState
                icon={Bell}
                title={typeFilter ? "Nothing in this category" : "You're all caught up"}
                description="Updates about homework, grades, bookings and messages will show up here."
                accent="text-averna-cyan"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {(["Today", "This week", "Earlier"] as const).map((label) =>
              buckets[label].length === 0 ? null : (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{label}</p>
                  <div className="space-y-2">
                    {buckets[label].map((n) => {
                      const body = (
                        <div
                          className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                            n.read ? "bg-white/5 border-white/10" : "bg-averna-cyan/10 border-averna-cyan/30"
                          }`}
                        >
                          <div className="mt-0.5">{iconFor(n.type)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-medium">{n.title}</p>
                            <p className="text-sm text-gray-300">{n.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-averna-neon mt-2" />}
                        </div>
                      );
                      return n.link ? <Link key={n.id} href={n.link}>{body}</Link> : <div key={n.id}>{body}</div>;
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
