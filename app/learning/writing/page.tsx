import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenTool, FileText, Clock, Target } from "lucide-react";
import Link from "next/link";

export default async function WritingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const tasks = [
    {
      id: "task1",
      type: "Task 1",
      title: "Academic Writing Task 1",
      description: "Describe visual information (graphs, charts, diagrams) in at least 150 words.",
      timeLimit: 20,
      wordCount: 150,
      icon: "📊",
      color: "purple",
    },
    {
      id: "task2",
      type: "Task 2",
      title: "Academic Writing Task 2",
      description: "Write an essay in response to a point of view, argument or problem in at least 250 words.",
      timeLimit: 40,
      wordCount: 250,
      icon: "📝",
      color: "blue",
    },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-2 block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <PenTool className="h-10 w-10 text-purple-400" />
            IELTS Writing
          </h1>
          <p className="text-gray-300">
            Practice Academic Writing with AI-powered feedback and band score estimation
          </p>
        </div>

        {/* Overview Card */}
        <Card className="glass border-purple-500/30 mb-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-purple-400">How It Works</CardTitle>
            <CardDescription>Get instant AI feedback on your writing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4">
                <div className="text-3xl mb-2">1️⃣</div>
                <p className="text-sm text-white font-semibold">Choose Task Type</p>
                <p className="text-xs text-gray-400 mt-1">Task 1 or Task 2</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">2️⃣</div>
                <p className="text-sm text-white font-semibold">Write Your Essay</p>
                <p className="text-xs text-gray-400 mt-1">Use the timer and word counter</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">3️⃣</div>
                <p className="text-sm text-white font-semibold">AI Analysis</p>
                <p className="text-xs text-gray-400 mt-1">Get detailed feedback</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">4️⃣</div>
                <p className="text-sm text-white font-semibold">Improve & Retry</p>
                <p className="text-xs text-gray-400 mt-1">Practice makes perfect</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Selection */}
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={`glass border-${task.color}-500/30 hover:shadow-neon-green transition-all duration-300 hover:scale-105`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-3xl">{task.icon}</span>
                    {task.type}
                  </CardTitle>
                  <span className={`text-xs px-3 py-1 rounded-full bg-${task.color}-500/20 text-${task.color}-400 border border-${task.color}-500/30`}>
                    {task.timeLimit} min
                  </span>
                </div>
                <CardDescription className="mt-2">{task.title}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-300">{task.description}</p>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>{task.timeLimit} minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <FileText className="h-4 w-4" />
                    <span>{task.wordCount}+ words</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Target className="h-4 w-4" />
                    <span>AI Feedback</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-averna-primary/20">
                  <Link href={`/learning/writing/${task.id}`}>
                    <Button className="w-full neon-button bg-averna-primary hover:bg-averna-light">
                      Start {task.type}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Assessment Info */}
        <Card className="glass border-averna-primary/30 mt-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-averna-neon">AI Assessment Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-white">Scoring Criteria:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Task Achievement:</strong> How well you address the task</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Coherence & Cohesion:</strong> Organization and flow</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Lexical Resource:</strong> Vocabulary range and accuracy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-averna-neon">✓</span>
                    <span><strong>Grammar:</strong> Range and accuracy of structures</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-white">You'll Receive:</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">🎯</span>
                    <span>Estimated IELTS Band Score (0-9)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">💪</span>
                    <span>Detailed strengths and weaknesses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">📚</span>
                    <span>Personalized recommendations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-400">🤖</span>
                    <span>AI-generated content detection</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
