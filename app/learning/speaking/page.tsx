export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bot, ClipboardList, Mic } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSpeakingTime } from "@/lib/utils";
import { levelLabel } from "@/lib/speaking/level";
import { PAUSED_MESSAGE, isPeerSpeakingPaused, peerPresence, studentPeerLevel } from "@/lib/speaking/peer-store";
import { PeerSpeakingHub, type PeerHubProps } from "@/components/speaking/peer-hub";

export const metadata = { title: "Speaking" };

const MORE = [
  {
    href: "/learning/speaking/solo",
    icon: Mic,
    title: "Practise alone",
    text: "Part 1, 2 and 3 questions with a Part 2 timer — at your own pace.",
  },
  {
    href: "/learning/examiner",
    icon: Bot,
    title: "AI Examiner",
    text: "Answer out loud and get an instant band estimate.",
  },
  {
    href: "/learning/speaking-test",
    icon: ClipboardList,
    title: "Full Speaking test",
    text: "The complete three-part interview.",
  },
];

/** The Speaking hub: peer 1-on-1 speaking first, then the other ways to practise (docs/peer-speaking.md §1). */
export default async function SpeakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = session.user.role;

  const hub: PeerHubProps = {
    mode: role === "STUDENT" ? "student" : role === "TEACHER" || role === "ADMIN" ? "staff" : "viewer",
    levelLabel: null,
    paused: false,
    pausedMessage: PAUSED_MESSAGE,
    initialLooking: 0,
    speakingTimeLive: isSpeakingTime(),
  };

  const now = Date.now();
  if (role === "STUDENT") {
    const student = await db.student
      .findUnique({ where: { userId: session.user.id }, select: { id: true, level: true, targetBand: true } })
      .catch(() => null);
    if (student) {
      const [level, paused, presence] = await Promise.all([
        studentPeerLevel(student),
        isPeerSpeakingPaused(student.id).catch(() => false),
        peerPresence(now, student.id).catch(() => null),
      ]);
      hub.levelLabel = levelLabel(level);
      hub.paused = paused;
      hub.initialLooking = presence?.total ?? 0;
    } else {
      hub.mode = "viewer";
    }
  } else {
    hub.initialLooking = (await peerPresence(now).catch(() => null))?.total ?? 0;
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-3xl px-4 py-4 pb-10 sm:py-6 lg:pb-6">
        <Link href="/learning" className="mb-3 inline-flex min-h-[44px] items-center text-sm text-averna-neon hover:underline">
          ← Back to Learning
        </Link>
        <PeerSpeakingHub {...hub} />

        <section aria-labelledby="speaking-more-title" className="mt-6">
          <h2 id="speaking-more-title" className="mb-3 text-lg font-semibold text-white">
            More ways to practise
          </h2>
          <ul role="list" className="grid gap-3 sm:grid-cols-3">
            {MORE.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="av-panel glow-hover group flex h-full min-h-[44px] flex-col gap-2 rounded-2xl p-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <m.icon className="h-4 w-4 text-averna-cyan" aria-hidden />
                    {m.title}
                    <ArrowRight
                      className="ml-auto h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </span>
                  <span className="text-xs text-gray-400">{m.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
