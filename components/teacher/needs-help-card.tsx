import { HeartHandshake } from "lucide-react";
import { hasOpenAI } from "@/lib/ai";
import { DASH_CARD } from "@/components/ui/dash-row";
import { loadNeedsHelp } from "@/lib/teacher/needs-help-load";
import { NeedsHelpList } from "./needs-help-list";

/**
 * "Who needs help today" on the teacher dashboard (idea 10). Server component:
 * loads the ranked list for the teacher's own students (cached five minutes)
 * and hands it to the interactive list. Teacher-only: the dashboard sends
 * admins to their own panel.
 */
export async function NeedsHelpCard({ teacherId }: { teacherId: string }) {
  const data = await loadNeedsHelp(teacherId).catch((e: unknown) => {
    console.error("NeedsHelpCard failed:", e instanceof Error ? e.message : e);
    return null;
  });
  if (!data) {
    return (
      <section aria-labelledby="needs-help-title" data-testid="needs-help" className={`${DASH_CARD} glass border-white/10 p-4 sm:p-5`}>
        <h2 id="needs-help-title" className="flex items-center gap-2 text-lg font-semibold text-white">
          <HeartHandshake className="h-5 w-5 text-averna-cyan" aria-hidden />
          Who needs help today
        </h2>
        <p className="mt-2 text-sm text-gray-300">The list couldn&apos;t be loaded right now. Refresh in a minute.</p>
      </section>
    );
  }
  return <NeedsHelpList rows={data.rows} todayKey={data.todayKey} students={data.students} aiDrafts={hasOpenAI()} />;
}
