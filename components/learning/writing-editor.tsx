"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, FileText, Send, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { VoiceInputButton } from "@/components/voice-input-button";

interface WritingEditorProps {
  prompt: {
    id: string;
    title: string;
    prompt: string;
    type: string;
    imageUrl?: string;
  };
  config: {
    title: string;
    timeLimit: number;
    wordCount: number;
    type: string;
  };
  userId: string;
}

export default function WritingEditor({ prompt, config, userId }: WritingEditorProps) {
  const router = useRouter();
  const [essay, setEssay] = useState("");
  const [timeLeft, setTimeLeft] = useState(config.timeLimit * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  // Calculate word count
  useEffect(() => {
    const words = essay.trim().split(/\s+/).filter((word) => word.length > 0);
    setWordCount(words.length);
  }, [essay]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timeLeft]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start timer on first character
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setEssay(value);
    
    if (!isTimerRunning && value.length > 0) {
      setIsTimerRunning(true);
    }
  };

  // Submit essay
  const handleSubmit = async () => {
    // Validate word count
    if (wordCount < config.wordCount) {
      setShowWarning(true);
      return;
    }

    setIsSubmitting(true);
    setShowWarning(false);

    try {
      const response = await fetch("/api/learning/writing/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay,
          taskType: config.type,
          prompt: prompt.prompt,
          timeSpent: (config.timeLimit * 60) - timeLeft,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit");

      const data = await response.json();
      
      // Redirect to results page
      router.push(`/learning/writing/result/${data.testId}`);
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to submit essay. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get timer color based on remaining time
  const getTimerColor = () => {
    const percentage = (timeLeft / (config.timeLimit * 60)) * 100;
    if (percentage > 50) return "text-green-400";
    if (percentage > 25) return "text-yellow-400";
    return "text-red-400";
  };

  // Get word count color
  const getWordCountColor = () => {
    if (wordCount >= config.wordCount) return "text-green-400";
    if (wordCount >= config.wordCount * 0.8) return "text-yellow-400";
    return "text-gray-400";
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <Link href="/learning/writing" className="text-averna-neon hover:underline text-sm mb-2 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Writing
          </Link>
          <h1 className="text-3xl font-bold text-white">{config.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{prompt.type}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Prompt */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="glass border-purple-500/30 sticky top-6 animate-fade-in">
              <CardHeader>
                <CardTitle className="text-purple-400">Task Prompt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">{prompt.title}</h3>
                  <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                    {prompt.prompt}
                  </p>
                </div>

                {prompt.imageUrl && (
                  <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-400 mb-2">Visual Data (Placeholder)</p>
                    <div className="aspect-video bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded flex items-center justify-center">
                      <p className="text-gray-400 text-sm">Chart/Graph/Diagram</p>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="space-y-2 pt-4 border-t border-purple-500/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Time Limit:</span>
                    <span className="text-white">{config.timeLimit} minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Min. Words:</span>
                    <span className="text-white">{config.wordCount}+ words</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Assessment:</span>
                    <span className="text-averna-neon">AI Powered</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Editor */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stats Bar */}
            <Card className="glass border-averna-primary/30 animate-fade-in">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {/* Timer */}
                    <div className="flex items-center gap-2">
                      <Clock className={`h-5 w-5 ${getTimerColor()}`} />
                      <span className={`text-2xl font-bold ${getTimerColor()}`}>
                        {formatTime(timeLeft)}
                      </span>
                    </div>

                    {/* Word Count */}
                    <div className="flex items-center gap-2">
                      <FileText className={`h-5 w-5 ${getWordCountColor()}`} />
                      <span className={`text-2xl font-bold ${getWordCountColor()}`}>
                        {wordCount}
                      </span>
                      <span className="text-sm text-gray-400">/ {config.wordCount}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || wordCount === 0}
                    className="neon-button bg-averna-primary hover:bg-averna-light"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit for AI Review
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Warning */}
            {showWarning && (
              <Card className="glass border-red-500/50 bg-red-500/10 animate-fade-in">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm">
                      Your essay must be at least {config.wordCount} words. Current: {wordCount} words
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Time's up warning */}
            {timeLeft === 0 && (
              <Card className="glass border-yellow-500/50 bg-yellow-500/10 animate-fade-in">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Clock className="h-5 w-5" />
                    <p className="text-sm">
                      Time's up! You can still submit your essay for review.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Text Editor */}
            <Card className="glass border-averna-primary/30 animate-fade-in">
              <CardContent className="pt-6">
                <Textarea
                  value={essay}
                  onChange={handleTextChange}
                  placeholder="Start writing your essay here..."
                  className="min-h-[500px] text-base leading-relaxed bg-background/50 border-averna-primary/20 focus:border-averna-neon resize-none"
                  disabled={isSubmitting}
                />
                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400">
                    💡 Tips: Focus on clear structure, varied vocabulary, and accurate grammar.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-averna-cyan hidden sm:inline">Dictate:</span>
                    <VoiceInputButton
                      onText={(t) =>
                        setEssay((prev) => {
                          const next = (prev ? prev + " " : "") + t.trim();
                          if (!isTimerRunning && next.length > 0) setIsTimerRunning(true);
                          return next;
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
