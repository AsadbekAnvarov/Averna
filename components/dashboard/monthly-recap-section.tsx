import { getMonthlyRecap } from "@/lib/student-intel";
import { Card, CardContent } from "@/components/ui/card";
import { Clapperboard } from "lucide-react";
import { MonthlyRecapView } from "@/components/dashboard/monthly-recap";

/** Server wrapper: computes this month's recap stats. */
export async function MonthlyRecapSection({ studentId }: { studentId: string }) {
  const recap = await getMonthlyRecap(studentId);

  if (!recap.hasData) {
    return (
      <Card className="glass border-averna-purple/30">
        <CardContent className="py-6 flex items-center gap-3">
          <Clapperboard className="h-5 w-5 text-averna-purple shrink-0" />
          <p className="text-sm text-gray-400">
            Your <span className="text-white">{recap.monthLabel}</span> recap will come alive as you study this month.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <MonthlyRecapView recap={recap} />;
}
