import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Flame } from "lucide-react";
import { db } from "@/lib/db";
import { timeAgo, initialsOf } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Classmates activity feed — light social motivation. Shows what groupmates
 * have been achieving recently ("Maria earned 30 pts"), which nudges friendly
 * competition without leaving the dashboard.
 */
export async function GroupFeed({ studentId, groupId }: { studentId: string; groupId: string | null }) {
  if (!groupId) return null;

  const logs = await db.activityLog.findMany({
    where: { student: { groupId, id: { not: studentId } }, points: { gt: 0 } },
    include: { student: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 7,
  });

  return (
    <Card className="glass border-averna-pink/30" data-gamified>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-pink">
          <Users className="h-5 w-5" /> Class Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Quiet in here…"
            description="When your classmates earn points and complete tasks, you'll see it here. Be the one to start!"
            accent="text-averna-pink"
            compact
          />
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => {
              const name = log.student.user.name ?? "A classmate";
              const initials = initialsOf(name);
              return (
                <li key={log.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-averna-pink/15 text-averna-pink text-xs font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">
                      <span className="font-semibold">{name}</span>{" "}
                      <span className="text-gray-400">{log.action.toLowerCase()}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">{timeAgo(log.createdAt)}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-averna-neon shrink-0">
                    <Flame className="h-3.5 w-3.5" /> +{log.points}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
