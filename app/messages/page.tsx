export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { messagesPhoneView } from "@/lib/messages-view";
import { MessageComposer } from "@/components/messages/message-composer";
import { MessageThread } from "@/components/messages/message-thread";
import { InboxTabs } from "@/components/inbox-tabs";

interface Contact {
  userId: string;
  name: string;
  sub: string;
}

async function getContacts(userId: string, role: string): Promise<Contact[]> {
  if (role === "STUDENT") {
    const student = await db.student.findUnique({
      where: { userId },
      include: { group: { include: { teacher: { include: { user: { select: { id: true, name: true } } } } } } },
    });
    if (student?.group?.teacher?.user) {
      return [{ userId: student.group.teacher.user.id, name: student.group.teacher.user.name ?? "Teacher", sub: "Your teacher" }];
    }
    return [];
  }
  if (role === "TEACHER") {
    const teacher = await db.teacher.findUnique({
      where: { userId },
      include: { groups: { include: { students: { include: { user: { select: { id: true, name: true } } } } } } },
    });
    const map = new Map<string, Contact>();
    teacher?.groups.forEach((g) =>
      g.students.forEach((s) =>
        map.set(s.user.id, { userId: s.user.id, name: s.user.name ?? "Student", sub: g.name })
      )
    );
    return Array.from(map.values());
  }
  if (role === "ADMIN") {
    const teachers = await db.teacher.findMany({ include: { user: { select: { id: true, name: true } } } });
    return teachers.map((t) => ({ userId: t.user.id, name: t.user.name ?? "Teacher", sub: "Teacher" }));
  }
  return [];
}

function homeHref(role: string) {
  if (role === "TEACHER") return "/teacher/dashboard";
  if (role === "ADMIN") return "/admin/dashboard";
  return "/dashboard";
}

export default async function MessagesPage(
  props: {
    searchParams: Promise<{ with?: string }>;
  }
) {
  const searchParams = (await props.searchParams) ?? {};
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const me = session.user.id;
  const role = session.user.role;

  const contacts = await getContacts(me, role);
  const activeId = searchParams.with ?? contacts[0]?.userId;
  const active = contacts.find((c) => c.userId === activeId) ?? contacts[0];
  // Phones (< md) show one half at a time; md+ keeps both cards side by side.
  const phoneView = messagesPhoneView(searchParams.with, contacts.length);

  let messages: { id: string; senderId: string; content: string; createdAt: Date; read: boolean; reaction: string | null }[] = [];
  if (active) {
    messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: me, receiverId: active.userId },
          { senderId: active.userId, receiverId: me },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    // mark incoming as read
    await db.message.updateMany({
      where: { senderId: active.userId, receiverId: me, read: false },
      data: { read: true },
    });
  }

  const threadMessages = messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    read: m.read,
    reaction: m.reaction,
  }));

  const [unreadMessages, unreadNotifications] = await Promise.all([
    db.message.count({ where: { receiverId: me, read: false } }),
    db.notification.count({ where: { userId: me, read: false } }),
  ]);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl pb-10 lg:pb-8">
        <PageHeader
          className="mb-4"
          back={{ href: homeHref(role), label: "Back to Dashboard" }}
          icon={MessageSquare}
          iconClassName="text-averna-pink"
          title={<span className="neon-text-purple">Messages</span>}
        />

        <InboxTabs unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />

        {contacts.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-2">
              <EmptyState
                icon={MessageSquare}
                title="No conversations yet"
                description={
                  role === "STUDENT"
                    ? "You'll be able to message your teacher once you're assigned to a group."
                    : "You have no contacts to message yet."
                }
                accent="text-averna-pink"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Contacts */}
            <Card className={`glass border-averna-cyan/30 md:col-span-1 ${phoneView === "thread" ? "hidden md:block" : ""}`}>
              <CardContent className="py-4 space-y-1 max-h-[60vh] overflow-y-auto">
                {contacts.map((c) => (
                  <Link
                    key={c.userId}
                    href={`/messages?with=${c.userId}`}
                    className={`block p-3 rounded-lg border transition-colors ${
                      active?.userId === c.userId
                        ? "bg-averna-cyan/10 border-averna-cyan/40"
                        : "bg-white/5 border-white/10 hover:border-averna-cyan/30"
                    }`}
                  >
                    <p className="text-white font-medium truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.sub}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Thread */}
            <Card
              className={`glass border-averna-purple/30 md:col-span-2 flex-col overflow-hidden ${
                phoneView === "list" ? "hidden md:flex" : "flex"
              }`}
            >
              {/* Phone height: the first screen minus the top bar (3.5rem), page header and inbox
                  tabs (~11.5rem incl. page padding), the bottom tab bar (4.5rem) and ~1.5rem of slack,
                  plus the safe-area insets. */}
              <CardContent className="py-4 flex flex-col h-[calc(100dvh-21rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[18rem] md:h-[60vh] md:min-h-0">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-3 shrink-0">
                  {contacts.length > 1 && (
                    <Link
                      href="/messages"
                      className="md:hidden -ml-2 inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-averna-neon hover:underline"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      {role === "ADMIN" ? "Barcha kontaktlar" : "All contacts"}
                    </Link>
                  )}
                  <p className="min-w-0 break-words text-white font-semibold">{active?.name}</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                  <MessageThread messages={threadMessages} meId={me} />
                </div>
                <MessageComposer receiverId={active!.userId} role={role} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
