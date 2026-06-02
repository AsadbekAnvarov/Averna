import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, FileText, Target, Play } from "lucide-react";
import Link from "next/link";

export default async function ReadingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const tests = [
    {
      id: "academic-1",
      title: "Academic Reading Test 1",
      description: "Technology and Innovation",
      passages: 3,
      questions: 40,
      timeLimit: 60,
      difficulty: "Intermediate",
      topics: ["Technology", "Science", "Society"],
    },
    {
      id: "academic-2",
      title: "Academic Reading Test 2",
      description: "Environment and Climate",
      passages: 3,
      questions: 40,
      timeLimit: 60,
      difficulty: "Advanced",
      topics: ["Environment", "Climate Change", "Policy"],
    },
    {
      id: "academic-3",
      title: "Academic Reading Test 3",
      description: "History and Culture",
      passages: 3,
      questions: 40,
      timeLimit: 60,
      difficulty: "Intermediate",
      topics: ["History", "Archaeology", "Culture"],
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
            <BookOpen className="h-10 w-10 text-blue-400" />
            IELTS Reading
          </h1>
          <p className="text-gray-300">
            Practice Academic Reading with automatic scoring and detailed feedback
          </p>
        </div>

        {/* How It Works */}
        <Card className="glass border-blue-500/30 mb-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-blue-400">How It Works</CardTitle>
            <CardDescription>Complete reading tests with instant results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4">
                <div className="text-3xl mb-2">1️⃣</div>
                <p className="text-sm text-white font-semibold">Choose Test</p>
                <p className="text-xs text-gray-400 mt-1">Select a reading test</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">2️⃣</div>
                <p className="text-sm text-white font-semibold">Read Passages</p>
                <p className="text-xs text-gray-400 mt-1">3 passages, 60 minutes</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">3️⃣</div>
                <p className="text-sm text-white font-semibold">Answer Questions</p>
                <p className="text-xs text-gray-400 mt-1">40 questions total</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">4️⃣</div>
                <p className="text-sm text-white font-semibold">Get Results</p>
                <p className="text-xs text-gray-400 mt-1">Instant band score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Selection */}
        <div className="space-y-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-white">Available Tests</h2>
          
          {tests.map((test) => (
            <Card
              key={test.id}
              className="glass border-blue-500/30 hover:shadow-neon-green transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-white">{test.title}</h3>
                      <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {test.difficulty}
                      </span>
                    </div>
                    
                    <p className="text-gray-300 mb-4">{test.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <FileText className="h-4 w-4" />
                        <span>{test.passages} passages</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Target className="h-4 w-4" />
                        <span>{test.questions} questions</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span>{test.timeLimit} minutes</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {test.topics.map((topic) => (
                        <span
                          key={topic}
                          className="text-xs px-2 py-1 bg-averna-primary/20 text-averna-neon rounded"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Link href={`/learning/reading/${test.id}`}>
                      <Button className="neon-button bg-blue-500 hover:bg-blue-600">
                        <Play className="mr-2 h-4 w-4" />
                        Start Test
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Scoring Info */}
        <Card className="glass border-averna-primary/30 mt-8 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-averna-neon">IELTS Reading Band Scores</CardTitle>
            <CardDescription>How your score is calculated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-3">Academic Reading</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">39-40 correct</span>
                    <span className="text-green-400 font-semibold">Band 9.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">37-38 correct</span>
                    <span className="text-green-400 font-semibold">Band 8.5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">35-36 correct</span>
                    <span className="text-blue-400 font-semibold">Band 8.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">33-34 correct</span>
                    <span className="text-blue-400 font-semibold">Band 7.5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">30-32 correct</span>
                    <span className="text-yellow-400 font-semibold">Band 7.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">27-29 correct</span>
                    <span className="text-yellow-400 font-semibold">Band 6.5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">23-26 correct</span>
                    <span className="text-orange-400 font-semibold">Band 6.0</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-3">Question Types</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>✓ Multiple Choice</li>
                  <li>✓ True/False/Not Given</li>
                  <li>✓ Yes/No/Not Given</li>
                  <li>✓ Matching Headings</li>
                  <li>✓ Sentence Completion</li>
                  <li>✓ Summary Completion</li>
                  <li>✓ Short Answer Questions</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
