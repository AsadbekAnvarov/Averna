import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Headphones } from "lucide-react";
import Link from "next/link";

export default async function ListeningPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
          <Headphones className="h-10 w-10 text-green-400" />
          IELTS Listening
        </h1>
        <Card className="glass border-green-500/30">
          <CardHeader>
            <CardTitle className="text-green-400">Coming Soon!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-4">Listening tests with audio player and automatic grading will be available soon.</p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>✓ Audio playback controls</li>
              <li>✓ 4 sections, 40 questions</li>
              <li>✓ Multiple question types</li>
              <li>✓ Instant band score</li>
            </ul>
            <Link href="/dashboard" className="mt-6 inline-block">
              <Button className="neon-button bg-averna-primary">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
