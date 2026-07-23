import { getGalaxy } from "@/lib/student-intel";
import { KnowledgeGalaxy } from "@/components/dashboard/knowledge-galaxy";

/** Server wrapper: loads real per-skill data for the galaxy. */
export async function KnowledgeGalaxySection({ studentId }: { studentId: string }) {
  const planets = await getGalaxy(studentId);
  return <KnowledgeGalaxy planets={planets} />;
}
