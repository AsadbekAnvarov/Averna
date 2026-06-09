import { Card, CardContent } from "@/components/ui/card";
import { Bot, ArrowRight } from "lucide-react";
import Link from "next/link";

const PROMPTS = [
  "How can I improve my Writing Task 2?",
  "Give me a Speaking Part 2 cue card",
  "Explain Reading True/False/Not Given",
];

/**
 * AI Mentor quick-access card — invites the student to ask for help in one tap,
 * with a few starter questions so they always know what they can ask.
 */
export function MentorCard() {
  return (
    <Card className="glass border-averna-neon/30">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-averna-neon/15 text-averna-neon">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-white">AI Mentor</p>
            <p className="text-xs text-gray-400">Stuck? Ask anything, anytime.</p>
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          {PROMPTS.map((p) => (
            <Link
              key={p}
              href="/mentor"
              className="group flex items-center justify-between gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="truncate">{p}</span>
              <ArrowRight className="h-3.5 w-3.5 text-gray-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>

        <Link
          href="/mentor"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium transition-colors"
        >
          <Bot className="h-4 w-4" /> Open AI Mentor
        </Link>
      </CardContent>
    </Card>
  );
}
