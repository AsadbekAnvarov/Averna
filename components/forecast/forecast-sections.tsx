import { loadForecastInput } from "@/lib/forecast/load";
import { BandForecastCard } from "./band-forecast-card";
import { PathToTargetCard } from "./path-to-target-card";

interface Props {
  studentId: string;
  targetBand: string | null | undefined;
}

/** Progress hero: the full band forecast (server data → client card). */
export async function BandForecastSection({ studentId, targetBand }: Props) {
  return <BandForecastCard input={await loadForecastInput(studentId, targetBand)} />;
}

/** Today / Learning: the compact "Path to 7.0" card with the exam date. */
export async function PathToTargetSection({ studentId, targetBand }: Props) {
  return <PathToTargetCard input={await loadForecastInput(studentId, targetBand)} />;
}
