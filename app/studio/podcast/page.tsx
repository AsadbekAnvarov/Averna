export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { DailyPodcast } from "@/components/dashboard/daily-podcast";

export const metadata = { title: "Daily Podcast · Practice Studio" };

export default function PodcastPage() {
  return (
    <StudioToolPage slug="podcast">
      <DailyPodcast />
    </StudioToolPage>
  );
}
