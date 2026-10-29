import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown } from "lucide-react";
import { initialsOf } from "@/lib/utils";
import { avatarSrc } from "@/lib/avatars";

export function StudentOfTheWeekCard({ name, image, level, title, points, weekly = true }: {
  name: string | null; image?: string | null; level: number; title: string; points: number; weekly?: boolean;
}) {
  const src = avatarSrc(image);
  return <Card className="glass relative flex h-full flex-col overflow-hidden border-yellow-400/30">
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-yellow-400/[0.06] to-transparent" />
    <CardHeader className="relative">
      <CardTitle className="flex items-center gap-2 text-yellow-400"><Crown className="h-5 w-5 shrink-0" aria-hidden />Student of the Week</CardTitle>
    </CardHeader>
    <CardContent className="relative flex flex-1 flex-col items-center justify-center gap-3 text-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-20 w-20 shrink-0 rounded-full border-2 border-yellow-400/40 object-cover" />
      ) : <div aria-hidden className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 border-yellow-400/40 bg-yellow-500/10 text-2xl font-bold text-yellow-300">{initialsOf(name)}</div>}
      <div className="max-w-full min-w-0">
        <p className="break-words text-lg font-semibold text-white">{name ?? "Student"}</p>
        <p className="mt-1 text-sm text-gray-400">Level {level} · {title}</p>
      </div>
      <p className="mt-1 text-xl font-semibold text-yellow-300">{weekly ? "+" : ""}{points.toLocaleString("en-US")} <span className="text-sm font-normal text-gray-400">{weekly ? "pts this week" : "lifetime points"}</span></p>
    </CardContent>
  </Card>;
}
