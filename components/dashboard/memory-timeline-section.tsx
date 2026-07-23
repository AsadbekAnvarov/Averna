import { getMemoryTimeline } from "@/lib/student-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { MemoryTimeline } from "@/components/dashboard/memory-timeline";

/** Server wrapper: computes the memory timeline and hands it to the client view. */
export async function MemoryTimelineSection({ studentId }: { studentId: string }) {
  const entries = await getMemoryTimeline(studentId);

  if (entries.length === 0) {
    return (
      <Card className="glass border-averna-neon/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-neon">
            <Brain className="h-5 w-5" /> Memory Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 py-4">
            Take a few tests and your memory timeline will map how well each skill sticks — and when to review.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <MemoryTimeline entries={entries} />;
}
