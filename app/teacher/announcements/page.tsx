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
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { PageHeader } from "@/components/ui/page-header";
import { notifyGroupStudents } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";

async function postAnnouncement(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: { groups: { select: { id: true, name: true } } },
  });
  if (!teacher) return;

  const groupId = formData.get("groupId") as string;
  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  if (!groupId || !title || !body) return;
  if (!teacher.groups.some((g) => g.id === groupId)) return;

  await db.announcement.create({
    data: {
      authorId: session.user.id,
      authorName: session.user.name ?? "Teacher",
      scope: "GROUP",
      groupId,
      title,
      body,
    },
  });

  await notifyGroupStudents(groupId, {
    type: "system",
    title: `📢 ${title}`,
    message: body.length > 80 ? body.slice(0, 80) + "…" : body,
    link: "/notifications",
  });

  revalidatePath("/teacher/announcements");
  redirect("/teacher/announcements?saved=1");
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: { groups: { orderBy: { name: "asc" } } },
  });
  if (!teacher) {
    return <AccountNotice title="No teacher profile found" message="Sign in with a teacher account to post announcements." />;
  }

  const groupIds = teacher.groups.map((g) => g.id);
  const recent = await db.announcement.findMany({
    where: { groupId: { in: groupIds } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  const groupName = (id: string | null) => teacher.groups.find((g) => g.id === id)?.name ?? "Group";

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/teacher/dashboard", label: "Back to Dashboard" }}
          icon={Megaphone}
          iconClassName="text-averna-pink"
          title={<span className="neon-text-purple">Announcements</span>}
          subtitle="Send a message to a whole group at once — everyone gets notified."
        />

        {searchParams.saved && (
          <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Announcement sent &amp; students notified!</div>
        )}

        {teacher.groups.length === 0 ? (
          <Card className="glass border-averna-primary/30"><CardContent className="py-8 text-center text-gray-300">No groups yet.</CardContent></Card>
        ) : (
          <Card className="glass border-averna-pink/30 mb-8">
            <CardHeader><CardTitle className="flex items-center gap-2 text-averna-pink"><Send className="h-5 w-5" /> New Announcement</CardTitle></CardHeader>
            <CardContent>
              <form action={postAnnouncement} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groupId">Group</Label>
                  <select id="groupId" name="groupId" required
                    className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink">
                    {teacher.groups.map((g) => <option key={g.id} value={g.id} className="bg-averna-dark">{g.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" placeholder="e.g., No class this Friday" className="bg-background/50" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Message</Label>
                  <textarea id="body" name="body" rows={4} placeholder="Write your announcement..."
                    className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-pink" required />
                </div>
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Send to group</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="text-white">Recent Announcements</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-gray-400 text-sm">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {recent.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white font-medium">{a.title}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/30 whitespace-nowrap">
                        {groupName(a.groupId)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 whitespace-pre-line break-words">{a.body}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{formatDateTime(a.createdAt)}</p>
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
