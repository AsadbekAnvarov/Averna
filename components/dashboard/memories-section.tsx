import { getMemories } from "@/lib/memories";
import { MemoriesCard } from "@/components/dashboard/memories-card";

/**
 * Server wrapper for F9 — Memories. Derives the student's memories from real
 * data and hands them to the client card. Renders nothing when there's no
 * meaningful memory yet (e.g. a brand-new student), so it never adds clutter.
 */
export async function MemoriesSection({ studentId }: { studentId: string }) {
  const memories = await getMemories(studentId);
  if (memories.length === 0) return null;
  return <MemoriesCard memories={memories} />;
}
