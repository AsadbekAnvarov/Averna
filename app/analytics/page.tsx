import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentAnalytics } from "@/lib/db-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, TrendingUp, Clock, Target } from "lucide-react";
import Link from "next/link";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const student = await (await import("@/lib/db")).db.student.findUnique({
    where: { userId: session.user.id },
  });

  if (!student) redirect("/auth/signin");

  const analytics = await getStudentAnalytics(student.id, 30);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <BarChart className="h-10 w-10 text-blue-400" />
          Study Analytics
        </h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="glass border-blue-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-blue-400" />
                Total Points (30d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-400">{analytics.totalPoints}</p>
            </CardContent>
          </Card>

          <Card className="glass border-green-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-400" />
                Tests Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-400">{analytics.totalTests}</p>
            </CardContent>
          </Card>

          <Card className="glass border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-purple-400" />
                Speaking Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-400">{analytics.totalSpeakingSessions}</p>
            </CardContent>
          </Card>

          <Card className="glass border-yellow-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                Homework Done
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-400">{analytics.totalHomework}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass border-averna-primary/30 mb-6">
          <CardHeader>
            <CardTitle>Activity Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Writing Practice</span>
                <span className="text-sm text-white">{analytics.tests.filter(t => t.module === "WRITING").length}</span>
              </div>
              <Progress value={(analytics.tests.filter(t => t.module === "WRITING").length / (analytics.totalTests || 1)) * 100} />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Reading Practice</span>
                <span className="text-sm text-white">{analytics.tests.filter(t => t.module === "READING").length}</span>
              </div>
              <Progress value={(analytics.tests.filter(t => t.module === "READING").length / (analytics.totalTests || 1)) * 100} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-averna-primary/30">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.activityLogs.slice(0, 10).map(log => (
                <div key={log.id} className="p-3 bg-averna-dark/30 rounded-lg flex justify-between">
                  <span className="text-sm text-white">{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-sm text-averna-neon">+{log.points} pts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
