export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { notifyUser } from "@/lib/notifications";

interface Contact {
  userId: string;
  name: string;
  sub: string;
}

async function sendMessage(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const receiverId = formData.get("receiverId") as string;
  const content = (formData.get("content") as string)?.trim();
  if (!receiverId || !content) redirect(`/messages?with=${receiverId}`);

  await db.message.create({
    data: { senderId: session.user.id, receiverId, content },
  });
  await notifyUser(receiverId, {
    type: "message",
    title: `New message from ${session.user.name ?? "someone"}`,
    message: content.length > 60 ? content.slice(0, 60) + "…" : content,
    link: `/messages?with=${session.user.id}`,
  });
  revalidatePath("/messages");
  redirect(`/messages?with=${receiverId}`);
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

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { with?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const me = session.user.id;
  const role = session.user.role;

  const contacts = await getContacts(me, role);
  const activeId = searchParams.with ?? contacts[0]?.userId;
  const active = contacts.find((c) => c.userId === activeId) ?? contacts[0];

  let messages: { id: string; senderId: string; content: string; createdAt: Date }[] = [];
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

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl pb-24 lg:pb-8">
        <Link href={homeHref(role)} className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-averna-pink" />
          <span className="neon-text-purple">Messages</span>
        </h1>

        {contacts.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-10 text-center text-gray-400">
              {role === "STUDENT"
                ? "You'll be able to message your teacher once you're assigned to a group."
                : "No contacts yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Contacts */}
            <Card className="glass border-averna-cyan/30 md:col-span-1">
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
            <Card className="glass border-averna-purple/30 md:col-span-2 flex flex-col">
              <CardContent className="py-4 flex flex-col h-[60vh]">
                <p className="text-white font-semibold border-b border-white/10 pb-2 mb-3">
                  {active?.name}
                </p>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center mt-8">
                      No messages yet. Say hello! 👋
                    </p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderId === me;
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                              mine
                                ? "bg-averna-primary text-white rounded-br-sm"
                                : "bg-white/10 text-gray-100 rounded-bl-sm"
                            }`}
                          >
                            {m.content}
                            <div className="text-[10px] opacity-60 mt-0.5">
                              {new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <form action={sendMessage} className="flex gap-2 mt-3 border-t border-white/10 pt-3">
                  <input type="hidden" name="receiverId" value={active?.userId} />
                  <Input
                    name="content"
                    placeholder="Type a message..."
                    autoComplete="off"
                    className="bg-background/50"
                    required
                  />
                  <Button type="submit" className="neon-button bg-averna-primary hover:bg-averna-light shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
