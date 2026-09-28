import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { deleteBlobs } from "@/lib/storage/blob";

type Tx = Prisma.TransactionClient;

/** How long a student delete waits for their audio files to go (best effort). */
const AUDIO_DELETE_TIMEOUT_MS = 5000;

/**
 * Fully removes a group and everything that depends on it, in FK-safe order:
 *  - unassigns its students (they become "pending" again, not deleted)
 *  - deletes attendance, lesson logs, homework + submissions
 *  - finally deletes the group itself
 */
async function deleteGroupWithTx(tx: Tx, groupId: string) {
  await tx.student.updateMany({ where: { groupId }, data: { groupId: null } });
  // Roster members have no account, so they can't be "unassigned" — they exist
  // only as part of this group and are removed with it. (The DB FK cascades too;
  // deleting explicitly keeps this transaction self-describing.)
  await tx.rosterStudent.deleteMany({ where: { groupId } }).catch(() => {});
  await tx.attendance.deleteMany({ where: { groupId } });
  await tx.lessonLog.deleteMany({ where: { groupId } });

  const hw = await tx.homework.findMany({ where: { groupId }, select: { id: true } });
  const hwIds = hw.map((h) => h.id);
  if (hwIds.length > 0) {
    await tx.homeworkSubmission.deleteMany({ where: { homeworkId: { in: hwIds } } });
    await tx.homework.deleteMany({ where: { groupId } });
  }

  await tx.group.delete({ where: { id: groupId } });
}

export async function deleteGroupCascade(groupId: string) {
  await db.$transaction((tx) => deleteGroupWithTx(tx, groupId), { timeout: 20000 });
}

/**
 * The student's recorded Speaking answers that still have a file in the Blob
 * store. Their rows go with the student (FK cascade), the files don't — and
 * afterwards nothing points at them any more. [] when they can't be read.
 */
async function speakingAudioUrls(studentId: string): Promise<string[]> {
  try {
    const rows = (await db.speakingRecording.findMany({
      where: { studentId, audioUrl: { not: null } },
      select: { audioUrl: true },
    })) as { audioUrl: string | null }[];
    return rows.map((r) => r.audioUrl).filter((u): u is string => typeof u === "string" && u.length > 0);
  } catch (e) {
    console.error("The student's Speaking recordings couldn't be listed (their audio files stay in storage):", e);
    return [];
  }
}

/**
 * Deletes a student and all of their data, then removes their login account.
 * Tutor bookings are released (not deleted) so the slot stays open. Their
 * Speaking audio files are removed from the Blob store once the delete has
 * committed (best effort — a failure never blocks or undoes the delete).
 */
export async function deleteStudentCascade(studentId: string) {
  // Collected first (outside the transaction: a failing read there would abort it).
  const audioUrls = await speakingAudioUrls(studentId);
  await db.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    if (!student) return;

    await tx.homeworkSubmission.deleteMany({ where: { studentId } });
    await tx.iELTSTest.deleteMany({ where: { studentId } });
    await tx.studentAchievement.deleteMany({ where: { studentId } });
    await tx.speakingSession.deleteMany({ where: { studentId } });
    await tx.activityLog.deleteMany({ where: { studentId } });
    await tx.parentStudentLink.deleteMany({ where: { studentId } });
    await tx.tutorSlot.updateMany({ where: { studentId }, data: { studentId: null } });
    await tx.attendance.deleteMany({ where: { studentId } });
    await tx.grade.deleteMany({ where: { studentId } });
    await tx.rewardRedemption.deleteMany({ where: { studentId } });
    await tx.payment.deleteMany({ where: { studentId } });
    await tx.speakingQueue.deleteMany({ where: { studentId } });

    await tx.student.delete({ where: { id: studentId } });
    await tx.user.delete({ where: { id: student.userId } });
  }, { timeout: 20000 });

  if (audioUrls.length > 0) {
    try {
      const ok = await deleteBlobs(audioUrls, { timeoutMs: AUDIO_DELETE_TIMEOUT_MS });
      if (!ok) console.error(`Deleted student ${studentId}: ${audioUrls.length} Speaking audio file(s) couldn't be removed from storage.`);
    } catch (e) {
      console.error("Deleted student's Speaking audio couldn't be removed from storage:", e);
    }
  }
}

/**
 * Deletes a teacher: removes all their groups (cascading), releases/clears any
 * records that merely reference them (grades, attendance, grading), deletes the
 * records they own (slots, notes, templates, lesson logs), then their account.
 * Students in the teacher's groups are unassigned, never deleted.
 */
export async function deleteTeacherCascade(teacherId: string) {
  await db.$transaction(async (tx) => {
    const teacher = await tx.teacher.findUnique({
      where: { id: teacherId },
      select: { userId: true, groups: { select: { id: true } } },
    });
    if (!teacher) return;

    for (const g of teacher.groups) {
      await deleteGroupWithTx(tx, g.id);
    }

    // Clear optional references so the FK constraints don't block deletion
    await tx.homeworkSubmission.updateMany({ where: { gradedBy: teacherId }, data: { gradedBy: null } });
    await tx.grade.updateMany({ where: { teacherId }, data: { teacherId: null } });
    await tx.attendance.updateMany({ where: { teacherId }, data: { teacherId: null } });
    await tx.speakingSession.updateMany({ where: { teacherId }, data: { teacherId: null } });

    // Delete records owned by the teacher
    await tx.tutorSlot.deleteMany({ where: { teacherId } });
    await tx.studentNote.deleteMany({ where: { teacherId } });
    await tx.homeworkTemplate.deleteMany({ where: { teacherId } });
    await tx.lessonLog.deleteMany({ where: { teacherId } });

    await tx.teacher.delete({ where: { id: teacherId } });
    await tx.user.delete({ where: { id: teacher.userId } });
  }, { timeout: 30000 });
}
