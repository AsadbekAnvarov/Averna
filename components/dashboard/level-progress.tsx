import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { getLevelInfo } from "@/lib/utils";

/**
 * Level progress bar with a preview of the next level — makes the points system
 * feel like a journey ("40 points to Explorer") rather than an abstract number.
 */
export function LevelProgress({ points }: { points: number }) {
  const info = getLevelInfo(points);
  const toNext = Math.max(0, info.next - points);

  return (
    <Card className="glass border-averna-purple/30">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-averna-purple/15 text-averna-purple font-bold">
              {info.level}
            </div>
            <div>
              <p className="text-xs text-gray-400">Level {info.level}</p>
              <p className="font-bold text-white flex items-center gap-1">
                <Star className="h-4 w-4 text-averna-purple" /> {info.title}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{points.toLocaleString()} pts</p>
            <p className="text-[11px] text-gray-500">{toNext.toLocaleString()} to next</p>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-averna-purple via-averna-pink to-averna-cyan transition-all"
            style={{ width: `${info.into}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5">
          {info.into}% toward Level {info.level + 1}
        </p>
      </CardContent>
    </Card>
  );
}
