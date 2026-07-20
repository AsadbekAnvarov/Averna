export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Megaphone, Send } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { notifyUsers } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";

async function postGlobal(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  if (!title || !body) return;

  await db.announcement.create({
    data: { authorId: session.user.id, authorName: session.user.name ?? "Admin", scope: "ALL", title, body },
  });

  // Notify everyone
  const users = await db.user.findMany({ select: { id: true } });
  await notifyUsers(users.map((u) => u.id), {
    type: "system",
    title: `📣 ${title}`,
    message: body.length > 80 ? body.slice(0, 80) + "…" : body,
    link: "/notifications",
  });

  revalidatePath("/admin/announcements");
  redirect("/admin/announcements?saved=1");
}

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: { saved?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const recent = await db.announcement.findMany({
    where: { scope: "ALL" },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <Link href="/admin/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Admin Panel</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-averna-neon" /> Global <span className="neon-text">Announcements</span>
        </h1>
        <p className="text-gray-400 mb-6">Broadcast a message to everyone at the centre — all students and teachers.</p>

        {searchParams.saved && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Sent to everyone &amp; notified!</div>}

        <Card className="glass border-averna-neon/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-neon"><Send className="h-5 w-5" /> New Global Announcement</CardTitle></CardHeader>
          <CardContent>
            <form action={postGlobal} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" placeholder="e.g., Centre closed on public holiday" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <textarea id="body" name="body" rows={4} placeholder="Write your announcement for everyone..."
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-neon" required />
              </div>
              <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Send to everyone</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="text-white">Recent</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-gray-400 text-sm">No global announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {recent.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white font-medium">{a.title}</p>
                    <p className="text-sm text-gray-400 mt-1 whitespace-pre-line break-words">{a.body}</p>
                    <p className="text-[11px] text-gray-500 mt-1">by {a.authorName} · {formatDateTime(a.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
