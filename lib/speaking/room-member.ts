/** The caller's seat in a peer room, shared by the Phase C peer APIs (docs/peer-speaking.md). Server only. */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Seat } from "./session";
import type { SessionRoomRow } from "./session-view";

export const ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export type RoomMember =
  | { fail: NextResponse }
  | { fail?: undefined; userId: string; room: SessionRoomRow & { createdAt?: Date | null }; seat: Seat; studentId: string; partnerId: string; partnerName: string };

/** 401 signed out · 400 bad id · 404 no room · 403 not one of its two students. */
export async function roomMember(roomId: unknown): Promise<RoomMember> {
  const session = await auth();
  if (!session?.user) return { fail: reply({ error: "Please sign in again.", code: "auth" }, 401) };
  if (typeof roomId !== "string" || !ROOM_ID.test(roomId)) return { fail: reply({ error: "Invalid room" }, 400) };
  const [student, room] = await Promise.all([
    db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    db.speakingRoom.findUnique({ where: { id: roomId } }) as Promise<SessionRoomRow | null>,
  ]);
  if (!room) return { fail: reply({ error: "Room not found" }, 404) };
  const seat: Seat | null = !student ? null : room.studentAId === student.id ? "A" : room.studentBId === student.id ? "B" : null;
  if (!seat || !student) return { fail: reply({ error: "Not your room" }, 403) };
  return {
    userId: session.user.id,
    room,
    seat,
    studentId: student.id,
    partnerId: seat === "A" ? room.studentBId : room.studentAId,
    partnerName: seat === "A" ? room.studentBName : room.studentAName,
  };
}
