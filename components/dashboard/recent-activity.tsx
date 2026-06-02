import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Trophy, BookOpen, Mic, Award } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";

interface RecentActivityProps {
  activities: Array<{
    id: string;
    action: string;
    details: any;
    points: number;
    createdAt: Date;
  }>;
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const getActivityIcon = (action: string) => {
    switch (action) {
      case "HOMEWORK_SUBMITTED":
        return <BookOpen className="h-4 w-4 text-purple-400" />;
      case "IELTS_TEST_COMPLETED":
        return <Trophy className="h-4 w-4 text-blue-400" />;
      case "SPEAKING_SESSION_COMPLETED":
        return <Mic className="h-4 w-4 text-orange-400" />;
      case "ACHIEVEMENT_UNLOCKED":
        return <Award className="h-4 w-4 text-yellow-400" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getActivityText = (action: string, details: any) => {
    switch (action) {
      case "HOMEWORK_SUBMITTED":
        return `Submitted homework${details?.position ? ` (${details.position}${getOrdinalSuffix(details.position)} place!)` : ''}`;
      case "IELTS_TEST_COMPLETED":
        return `Completed ${details?.module || 'IELTS'} test${details?.score ? ` - Score: ${details.score}` : ''}`;
      case "SPEAKING_SESSION_COMPLETED":
        return `Attended Speaking Time${details?.duration ? ` - ${details.duration}min` : ''}`;
      case "ACHIEVEMENT_UNLOCKED":
        return `Unlocked: ${details?.achievementName || 'New Achievement'}`;
      default:
        return action.replace(/_/g, ' ').toLowerCase();
    }
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  if (activities.length === 0) {
    return (
      <Card className="glass border-averna-primary/30 animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-averna-neon" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your learning history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent activity</p>
            <p className="text-sm mt-1">Start learning to track your progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-averna-primary/30 animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-averna-neon" />
          Recent Activity
        </CardTitle>
        <CardDescription>Your last {activities.length} activities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-averna-dark/30 border border-averna-primary/10 hover:border-averna-primary/30 transition-colors"
              style={{
                animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <div className="mt-0.5">{getActivityIcon(activity.action)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  {getActivityText(activity.action, activity.details)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(activity.createdAt)} at {formatTime(activity.createdAt)}
                </p>
              </div>
              {activity.points > 0 && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-averna-neon font-semibold text-sm">
                    +{activity.points}
                  </div>
                  <div className="text-xs text-gray-400">pts</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
