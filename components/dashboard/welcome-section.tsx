import { Card, CardContent } from "@/components/ui/card";
import { Quote, Target } from "lucide-react";
import { getRandomQuote } from "@/lib/utils";

interface WelcomeSectionProps {
  student: {
    user: {
      name: string | null;
    };
    personalGoal: string | null;
  };
  quote: {
    text: string;
    author: string | null;
  } | null;
}

export function WelcomeSection({ student, quote }: WelcomeSectionProps) {
  const firstName = student.user.name?.split(" ")[0] || "Student";
  const displayQuote = quote || { text: getRandomQuote(), author: "Averna Team" };
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
      {/* Welcome Card */}
      <Card className="glass border-averna-primary/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-averna-primary/20 to-transparent" />
        <CardContent className="relative pt-6">
          <h2 className="text-3xl font-bold text-white mb-2">
            {getGreeting()}, {firstName}! 👋
          </h2>
          <p className="text-gray-300 mb-4">
            Welcome back to your learning journey
          </p>
          
          {student.personalGoal && (
            <div className="flex items-center gap-2 bg-averna-primary/30 rounded-lg p-3 mt-4">
              <Target className="h-5 w-5 text-averna-neon flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Your Goal</p>
                <p className="text-sm font-semibold text-averna-neon">
                  {student.personalGoal}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Quote Card */}
      <Card className="glass border-averna-primary/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-averna-accent/20 to-transparent" />
        <CardContent className="relative pt-6">
          <div className="flex items-start gap-3">
            <Quote className="h-8 w-8 text-averna-neon flex-shrink-0 mt-1" />
            <div>
              <p className="text-lg text-white leading-relaxed mb-2 italic">
                "{displayQuote.text}"
              </p>
              <p className="text-sm text-gray-400">
                — {displayQuote.author}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
