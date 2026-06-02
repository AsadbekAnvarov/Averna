"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function HomeworkSubmissionForm({
  homework,
  studentId,
  submissionCount,
}: {
  homework: any;
  studentId: string;
  submissionCount: number;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert("Please write your answer");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/homework/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeworkId: homework.id,
          content,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit");

      const data = await response.json();
      alert(`Submitted! You're #${data.position}. Points: ${data.points}`);
      router.push("/homework");
    } catch (error) {
      console.error(error);
      alert("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const potentialBonus = submissionCount === 0 ? 10 : submissionCount === 1 ? 8 : submissionCount === 2 ? 6 : 0;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/homework" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Homework
        </Link>
        
        <Card className="glass border-purple-500/30 mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">{homework.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">{homework.module}</span>
              <span className="text-gray-400">{'⭐'.repeat(homework.difficulty)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300 whitespace-pre-line">{homework.description}</p>
            
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-gray-400">
                📅 Due: {formatDate(homework.dueDate)}
              </span>
              <span className="flex items-center gap-1 text-averna-neon">
                <Trophy className="h-4 w-4" />
                Base: {homework.points} pts
              </span>
            </div>

            {potentialBonus > 0 && (
              <div className="bg-averna-neon/10 border border-averna-neon/30 rounded-lg p-4">
                <p className="text-averna-neon font-semibold">
                  ⚡ Submit now for +{potentialBonus} bonus points!
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {submissionCount} submission{submissionCount !== 1 ? 's' : ''} so far
                </p>
              </div>
            )}

            {submissionCount >= 3 && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Users className="h-4 w-4" />
                {submissionCount} students have submitted
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-averna-primary/30">
          <CardHeader>
            <CardTitle>Your Answer</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your homework answer here..."
              className="min-h-[400px] bg-background/50"
              disabled={isSubmitting}
            />
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim()}
              className="w-full mt-4 neon-button bg-purple-500 hover:bg-purple-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Homework
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
