export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Clock } from "lucide-react";
import Link from "next/link";
import { isSpeakingTime, getTimeUntilSpeakingTime } from "@/lib/utils";

export default async function SpeakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const isLive = isSpeakingTime();
  const timeText = getTimeUntilSpeakingTime();

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
          <Mic className="h-10 w-10 text-orange-400" />
          IELTS Speaking
        </h1>

        {/* Speaking Time Status */}
        <Card className={`glass mb-6 ${isLive ? 'border-averna-neon/50 animate-pulse' : 'border-orange-500/30'}`}>
          <CardHeader>
            <CardTitle className={isLive ? "text-averna-neon" : "text-orange-400"}>
              {isLive ? "🔴 Speaking Time is LIVE NOW!" : "Speaking Time Schedule"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-gray-300 mb-4">
              <Clock className="h-5 w-5" />
              <span className="text-lg">{timeText}</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Join our daily speaking sessions from 19:00 to 21:00 to practice with teachers and fellow students.
            </p>
            {isLive ? (
              <Button className="neon-button bg-averna-neon text-black hover:bg-averna-light animate-pulse">
                Join Speaking Room
              </Button>
            ) : (
              <Button disabled className="bg-gray-600">
                Available at 19:00
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Practice Questions */}
        <Card className="glass border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-orange-400">Practice Questions (Coming Soon)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-4">Generate IELTS speaking questions for practice:</p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>✓ Part 1: Introduction and Interview</li>
              <li>✓ Part 2: Long Turn (Cue Card)</li>
              <li>✓ Part 3: Two-way Discussion</li>
              <li>✓ AI-generated questions</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
