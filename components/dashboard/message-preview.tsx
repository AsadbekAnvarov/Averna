import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Inline preview of the student's latest conversations with a quick jump into
 * the chat — so messages from teachers don't get missed.
 */
export async function MessagePreview({ userId }: { userId: string }) {
  const messages = await db.message.findMany({
    where: { OR: [{ receiverId: userId }, { senderId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  });

  // Collapse into latest message per conversation partner
  const seen = new Set<string>();
  const threads = [] as {
    partnerId: string;
    partnerName: string;
    content: string;
    incoming: boolean;
    unread: boolean;
    createdAt: Date;
  }[];
  for (const m of messages) {
    const incoming = m.receiverId === userId;
    const partner = incoming ? m.sender : m.receiver;
    if (!partner?.id || seen.has(partner.id)) continue;
    seen.add(partner.id);
    threads.push({
      partnerId: partner.id,
      partnerName: partner.name ?? "User",
      content: m.content,
      incoming,
      unread: incoming && !m.read,
      createdAt: m.createdAt,
    });
    if (threads.length >= 4) break;
  }

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-cyan">
            <MessageSquare className="h-5 w-5" /> Messages
          </span>
          <Link href="/messages" className="text-xs font-normal text-averna-cyan hover:underline flex items-center gap-1">
            Open <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Reach out to your teacher with any question — they're here to help."
            action={{ label: "Start a chat", href: "/messages" }}
            accent="text-averna-cyan"
            compact
          />
        ) : (
          <div className="space-y-1.5">
            {threads.map((t) => {
              const initials = t.partnerName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <Link
                  key={t.partnerId}
                  href={`/messages?with=${t.partnerId}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-averna-cyan/15 text-averna-cyan text-xs font-bold">
                    {initials}
                    {t.unread && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-averna-pink border border-averna-dark" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${t.unread ? "text-white font-semibold" : "text-gray-300"}`}>{t.partnerName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {t.incoming ? "" : "You: "}
                      {t.content}
                    </p>
                  </div>
                  <span className="text-[11px] text-gray-500 shrink-0">{timeAgo(t.createdAt)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
