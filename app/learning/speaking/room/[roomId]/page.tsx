export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasOpenAI } from "@/lib/ai";
import { peerSessionAward } from "@/lib/speaking/peer-xp";
import { isPeerSessionState, type Seat } from "@/lib/speaking/session";
import { finishedNaturally, sessionView, type SessionRoomRow } from "@/lib/speaking/session-view";
import { PeerRoom } from "@/components/speaking/peer-room";

export const metadata = { title: "Speaking room" };

type Props = { params: Promise<{ roomId: string }> };

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-md px-4 py-10">
        <section className="av-panel rounded-2xl p-6 text-center">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="mt-2 text-sm text-gray-300">{text}</p>
          <Link
            href="/learning/speaking"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-averna-primary px-5 text-sm font-semibold text-white"
          >
            Back to Speaking
          </Link>
        </section>
      </div>
    </div>
  );
}

/** A peer speaking room (docs/peer-speaking.md, Phase B): the two students of the room only. */
export default async function SpeakingRoomPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const { roomId } = await params;

  if (session.user.role !== "STUDENT") {
    return <Notice title="Peer rooms are for students" text="Only the two students in a session can join its room." />;
  }
  const unavailable = <Notice title="This session isn't available" text="It may belong to other students, or the link is wrong. Find a new partner on the Speaking page." />;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId)) return unavailable;

  const [student, room] = await Promise.all([
    db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } }).catch(() => null),
    db.speakingRoom.findUnique({ where: { id: roomId } }).catch(() => null) as Promise<SessionRoomRow | null>,
  ]);
  if (!student || !room) return unavailable;
  const seat: Seat | null = room.studentAId === student.id ? "A" : room.studentBId === student.id ? "B" : null;
  if (!seat) return unavailable;
  if (!isPeerSessionState(room.state)) {
    return <Notice title="This session has ended" text="It was made with the old room, which is no longer available. Find a new partner on the Speaking page." />;
  }

  const xp = finishedNaturally(room.state) ? await peerSessionAward(room.id, student.id).catch(() => null) : null;
  const view = sessionView(room, seat, Date.now(), xp);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-3xl px-3 py-4 pb-10 sm:px-4 sm:py-6 lg:pb-6">
        <Link href="/learning/speaking" className="mb-3 inline-flex min-h-[44px] items-center text-sm text-averna-neon hover:underline">
          ← Back to Speaking
        </Link>
        <h1 className="sr-only">Speaking room</h1>
        <PeerRoom initial={{ ...view, state: room.state }} coachAvailable={hasOpenAI()} />
      </div>
    </div>
  );
}
