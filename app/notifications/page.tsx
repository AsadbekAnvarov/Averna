export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, BookMarked, Award, CalendarClock, MessageSquare, Info } from "lucide-react";
import Link from "next/link";

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

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Mark them read when the page is viewed (after we've loaded them)
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-24 lg:pb-8">
        <Link href={homeHref(session.user.role)} className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Bell className="h-8 w-8 text-averna-cyan" />
            Notifications
          </h1>
          {hasUnread && (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" size="sm" className="border-averna-neon text-averna-neon">
                <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
              </Button>
            </form>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-10 text-center text-gray-400">
              🔔 No notifications yet. You&apos;ll see updates about homework, grades and bookings here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const body = (
                <div
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    n.read
                      ? "bg-white/5 border-white/10"
                      : "bg-averna-cyan/10 border-averna-cyan/30"
                  }`}
                >
                  <div className="mt-0.5">{iconFor(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium">{n.title}</p>
                    <p className="text-sm text-gray-300">{n.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Tashkent" })}
                    </p>
                  </div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-averna-neon mt-2" />}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link}>{body}</Link>
              ) : (
                <div key={n.id}>{body}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
