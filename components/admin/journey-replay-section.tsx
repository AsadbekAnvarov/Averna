import { getRecentJourneys } from "@/lib/admin-journeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footprints } from "lucide-react";
import { JourneyReplay } from "@/components/admin/journey-replay";

/** Server wrapper: fetches recent journeys and hands them to the client player. */
export async function JourneyReplaySection() {
  const sessions = await getRecentJourneys(8);

  if (sessions.length === 0) {
    return (
      <Card className="glass border-averna-purple/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-purple">
            <Footprints className="h-5 w-5" /> Sessiya Repleyi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 py-4">Hozircha faollik qayd etilmadi — sessiyalar shu yerda paydo boʻladi.</p>
        </CardContent>
      </Card>
    );
  }

  return <JourneyReplay sessions={sessions} />;
}
