import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface UpcomingHomeworkProps {
  homework: Array<{
    id: string;
    title: string;
    description: string;
    dueDate: Date;
    points: number;
    difficulty: number;
    module: string;
    teacher: {
      user: {
        name: string | null;
      };
    };
  }>;
}

export function UpcomingHomework({ homework }: UpcomingHomeworkProps) {
  const getDaysUntilDue = (dueDate: Date) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    if (diffDays < 0) return "Overdue";
    return `${diffDays} days left`;
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case "WRITING":
        return "text-purple-400 bg-purple-500/10 border-purple-500/30";
      case "READING":
        return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      case "LISTENING":
        return "text-green-400 bg-green-500/10 border-green-500/30";
      case "SPEAKING":
        return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/30";
    }
  };

  if (homework.length === 0) {
    return (
      <Card className="glass border-averna-primary/30 animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-averna-neon" />
            Upcoming Homework
          </CardTitle>
          <CardDescription>Your pending assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No upcoming homework</p>
            <p className="text-sm mt-1">Check back later for new assignments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-averna-primary/30 animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-averna-neon" />
              Upcoming Homework
            </CardTitle>
            <CardDescription>{homework.length} pending assignment{homework.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          <Link href="/homework">
            <Button variant="ghost" size="sm" className="text-averna-neon hover:bg-averna-primary/20">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {homework.map((hw) => {
            const daysText = getDaysUntilDue(hw.dueDate);
            const isUrgent = daysText === "Due today" || daysText === "Due tomorrow" || daysText === "Overdue";

            return (
              <Link
                key={hw.id}
                href={`/homework/${hw.id}`}
                className="block p-4 rounded-lg border border-averna-primary/20 hover:border-averna-neon/50 transition-all duration-300 hover:shadow-neon-green bg-averna-dark/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${getModuleColor(hw.module)}`}>
                        {hw.module}
                      </span>
                      <span className="text-xs text-gray-400">
                        {'⭐'.repeat(hw.difficulty)}
                      </span>
                    </div>
                    <h4 className="font-semibold text-white truncate mb-1">
                      {hw.title}
                    </h4>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                      {hw.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(hw.dueDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className={isUrgent ? "h-3 w-3 text-red-400" : "h-3 w-3"} />
                        <span className={isUrgent ? "text-red-400 font-semibold" : ""}>
                          {daysText}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-averna-neon font-bold text-lg">
                      {hw.points}
                    </div>
                    <div className="text-xs text-gray-400">points</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
