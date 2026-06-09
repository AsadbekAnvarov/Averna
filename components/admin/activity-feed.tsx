import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Radio, UserPlus, Megaphone, Gift, CheckSquare, Layers, GraduationCap,
  Trash2, Pencil, Settings, ShieldCheck, Activity as ActivityIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";

/** Pick an icon + accent colour from the audit action text. */
function iconFor(action: string): { Icon: any; color: string } {
  const a = action.toLowerCase();
  if (a.includes("enroll")) return { Icon: UserPlus, color: "bg-averna-pink/15 text-averna-pink" };
  if (a.includes("announce") || a.includes("broadcast")) return { Icon: Megaphone, color: "bg-orange-400/15 text-orange-400" };
  if (a.includes("reward") || a.includes("redempt")) return { Icon: Gift, color: "bg-averna-pink/15 text-averna-pink" };
  if (a.includes("grade") || a.includes("homework")) return { Icon: CheckSquare, color: "bg-amber-400/15 text-amber-400" };
  if (a.includes("group")) return { Icon: Layers, color: "bg-averna-purple/15 text-averna-purple" };
  if (a.includes("teacher")) return { Icon: GraduationCap, color: "bg-averna-blue/15 text-averna-blue" };
  if (a.includes("delete") || a.includes("remove")) return { Icon: Trash2, color: "bg-red-400/15 text-red-400" };
  if (a.includes("creat") || a.includes("add")) return { Icon: Pencil, color: "bg-averna-neon/15 text-averna-neon" };
  if (a.includes("system") || a.includes("setting")) return { Icon: Settings, color: "bg-averna-cyan/15 text-averna-cyan" };
  return { Icon: ActivityIcon, color: "bg-white/10 text-gray-300" };
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-averna-purple/20 text-averna-purple",
  TEACHER: "bg-averna-cyan/20 text-averna-cyan",
  STUDENT: "bg-averna-neon/20 text-averna-neon",
};

/**
 * Live activity feed — the latest admin/teacher actions across the platform,
 * straight from the audit log. Gives admins the "pulse" of the system.
 */
export async function ActivityFeed() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <Card className="glass border-averna-neon/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-neon">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-averna-neon opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-averna-neon" />
          </span>
          <Radio className="h-5 w-5" /> Live Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 py-2 text-center">No activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-1">
            {logs.map((log) => {
              const { Icon, color } = iconFor(log.action);
              const badge = ROLE_BADGE[log.role] ?? "bg-white/10 text-gray-300";
              return (
                <li
                  key={log.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      <span className="font-semibold">{log.actorName}</span>{" "}
                      <span className="text-gray-300">{log.action.toLowerCase()}</span>
                    </p>
                    {log.detail && (
                      <p className="text-xs text-gray-500 truncate">{log.detail}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge}`}>{log.role}</span>
                    <span className="text-[11px] text-gray-500">{timeAgo(log.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
