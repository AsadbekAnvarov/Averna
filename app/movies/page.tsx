import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Film, Play, Clock, BookOpen, Target, Star } from "lucide-react";
import Link from "next/link";

export default async function MoviesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const movies = [
    {
      id: "1",
      title: "The Social Network",
      year: 2010,
      level: "Advanced",
      duration: "120 min",
      topics: ["Technology", "Business", "Communication"],
      vocabularyCount: 450,
      description: "Learn business English and technology vocabulary through the story of Facebook's creation.",
      points: 100,
      thumbnail: "🎬",
      color: "blue",
    },
    {
      id: "2",
      title: "The Pursuit of Happyness",
      year: 2006,
      level: "Intermediate",
      duration: "117 min",
      topics: ["Motivation", "Career", "Life"],
      vocabularyCount: 380,
      description: "Improve everyday English and motivational language through an inspiring true story.",
      points: 80,
      thumbnail: "🎭",
      color: "green",
    },
    {
      id: "3",
      title: "The King's Speech",
      year: 2010,
      level: "Advanced",
      duration: "118 min",
      topics: ["History", "Communication", "Leadership"],
      vocabularyCount: 500,
      description: "Learn formal English and historical vocabulary through the story of King George VI.",
      points: 120,
      thumbnail: "👑",
      color: "purple",
    },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Film className="h-10 w-10 text-pink-400" />
          Movie Time
        </h1>
        <p className="text-gray-300 mb-8">
          Learn English through movies with vocabulary lists, subtitles, and quizzes!
        </p>

        {/* How It Works */}
        <Card className="glass border-pink-500/30 mb-8">
          <CardHeader>
            <CardTitle className="text-pink-400">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4">
                <div className="text-3xl mb-2">1️⃣</div>
                <p className="text-sm text-white font-semibold">Choose Movie</p>
                <p className="text-xs text-gray-400 mt-1">Pick your level</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">2️⃣</div>
                <p className="text-sm text-white font-semibold">Watch & Learn</p>
                <p className="text-xs text-gray-400 mt-1">With subtitles</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">3️⃣</div>
                <p className="text-sm text-white font-semibold">Study Vocabulary</p>
                <p className="text-xs text-gray-400 mt-1">Key words & phrases</p>
              </div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">4️⃣</div>
                <p className="text-sm text-white font-semibold">Take Quiz</p>
                <p className="text-xs text-gray-400 mt-1">Earn points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Movies Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {movies.map((movie) => (
            <Card
              key={movie.id}
              className={`glass border-${movie.color}-500/30 hover:shadow-neon-green transition-all duration-300 hover:scale-105`}
            >
              <CardHeader>
                <div className="text-center mb-4">
                  <div className="text-6xl mb-3">{movie.thumbnail}</div>
                  <CardTitle className="text-xl mb-1">{movie.title}</CardTitle>
                  <p className="text-xs text-gray-400">({movie.year})</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full bg-${movie.color}-500/20 text-${movie.color}-400 border border-${movie.color}-500/30`}>
                    {movie.level}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {movie.duration}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-300 text-center">
                  {movie.description}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Vocabulary
                    </span>
                    <span className="text-white font-semibold">
                      {movie.vocabularyCount} words
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Points
                    </span>
                    <span className="text-averna-neon font-semibold">
                      {movie.points} pts
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {movie.topics.map((topic) => (
                    <span
                      key={topic}
                      className="text-xs px-2 py-1 bg-averna-primary/20 text-averna-neon rounded"
                    >
                      {topic}
                    </span>
                  ))}
                </div>

                <Button
                  disabled
                  className="w-full neon-button bg-pink-500 hover:bg-pink-600"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Coming Soon
                </Button>

                <p className="text-xs text-center text-gray-400">
                  Full feature launching soon with:
                  <br />
                  • Video player with subtitles
                  <br />
                  • Vocabulary flashcards
                  <br />
                  • Comprehension quiz
                  <br />• Discussion questions
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Preview */}
        <Card className="glass border-averna-primary/30 mt-8">
          <CardHeader>
            <CardTitle className="text-averna-neon">Coming Soon Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  Learning Features
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>✓ Interactive subtitles (click word for definition)</li>
                  <li>✓ Vocabulary lists with context</li>
                  <li>✓ Pronunciation guide</li>
                  <li>✓ Scene-by-scene breakdown</li>
                  <li>✓ Rewind specific dialogues</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  Assessment
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>✓ Comprehension quiz after watching</li>
                  <li>✓ Vocabulary flashcard game</li>
                  <li>✓ Discussion questions</li>
                  <li>✓ Essay prompt (IELTS style)</li>
                  <li>✓ Points & achievements</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
