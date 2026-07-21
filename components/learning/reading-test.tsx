"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, Send, Loader2, ArrowLeft, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/toast";

interface ReadingTestProps {
  test: {
    id: string;
    title: string;
    description: string;
    timeLimit: number;
    passages: Array<{
      id: string;
      title: string;
      text: string;
      questions: Array<{
        id: string;
        type: string;
        question: string;
        options?: string[];
        correctAnswer: any;
      }>;
    }>;
  };
  userId: string;
}

export default function ReadingTest({ test, userId }: ReadingTestProps) {
  const router = useRouter();
  const [currentPassage, setCurrentPassage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(test.timeLimit * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    const percentage = (timeLeft / (test.timeLimit * 60)) * 100;
    if (percentage > 50) return "text-green-400";
    if (percentage > 25) return "text-yellow-400";
    return "text-red-400";
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const getTotalQuestions = () => {
    return test.passages.reduce((sum, passage) => sum + passage.questions.length, 0);
  };

  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  const handleAutoSubmit = async () => {
    await handleSubmit(true);
  };

  const handleSubmit = async (auto = false) => {
    const totalQuestions = getTotalQuestions();
    const answeredCount = getAnsweredCount();

    if (!auto && answeredCount < totalQuestions) {
      setShowWarning(true);
      return;
    }

    setIsSubmitting(true);
    setShowWarning(false);

    try {
      const response = await fetch("/api/learning/reading/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: test.id,
          answers,
          timeSpent: (test.timeLimit * 60) - timeLeft,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit");

      const data = await response.json();
      router.push(`/learning/reading/result/${data.testId}`);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit test. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const passage = test.passages[currentPassage];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <Link href="/learning/reading" className="text-averna-neon hover:underline text-sm mb-2 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Reading
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{test.title}</h1>
              <p className="text-gray-400 text-sm mt-1">{test.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className={`h-6 w-6 ${getTimerColor()}`} />
                <span className={`text-3xl font-bold ${getTimerColor()}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <Card className="glass border-blue-500/30 mb-6 animate-fade-in">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  Passage {currentPassage + 1} of {test.passages.length}
                </span>
                <span className="text-sm text-gray-400">|</span>
                <span className="text-sm text-gray-400">
                  Questions Answered: {getAnsweredCount()} / {getTotalQuestions()}
                </span>
              </div>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="neon-button bg-blue-500 hover:bg-blue-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Test
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        {showWarning && (
          <Card className="glass border-red-500/50 bg-red-500/10 mb-6 animate-fade-in">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">
                  You haven't answered all questions. Are you sure you want to submit?
                </p>
                <Button
                  size="sm"
                  onClick={() => handleSubmit(true)}
                  className="ml-auto bg-red-500 hover:bg-red-600"
                >
                  Submit Anyway
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Passage */}
          <Card className="glass border-blue-500/30 animate-fade-in h-fit sticky top-6">
            <CardHeader>
              <CardTitle className="text-blue-400">{passage.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                <p className="text-gray-300 leading-relaxed whitespace-pre-line text-sm">
                  {passage.text}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <div className="space-y-6">
            <Card className="glass border-averna-primary/30 animate-fade-in">
              <CardHeader>
                <CardTitle>Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {passage.questions.map((question, index) => (
                  <div key={question.id} className="p-4 bg-averna-dark/30 rounded-lg border border-averna-primary/20">
                    <p className="font-semibold text-white mb-3">
                      {index + 1}. {question.question}
                    </p>

                    {/* Multiple Choice */}
                    {question.type === "multiple-choice" && question.options && (
                      <RadioGroup
                        value={answers[question.id]?.toString()}
                        onValueChange={(value) => handleAnswerChange(question.id, parseInt(value))}
                      >
                        {question.options.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value={optIndex.toString()} id={`${question.id}-${optIndex}`} />
                            <Label htmlFor={`${question.id}-${optIndex}`} className="text-gray-300 cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {/* True/False/Not Given */}
                    {question.type === "true-false-not-given" && (
                      <RadioGroup
                        value={answers[question.id]}
                        onValueChange={(value) => handleAnswerChange(question.id, value)}
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          <RadioGroupItem value="true" id={`${question.id}-true`} />
                          <Label htmlFor={`${question.id}-true`} className="text-gray-300 cursor-pointer">
                            True
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                          <RadioGroupItem value="false" id={`${question.id}-false`} />
                          <Label htmlFor={`${question.id}-false`} className="text-gray-300 cursor-pointer">
                            False
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="not-given" id={`${question.id}-ng`} />
                          <Label htmlFor={`${question.id}-ng`} className="text-gray-300 cursor-pointer">
                            Not Given
                          </Label>
                        </div>
                      </RadioGroup>
                    )}

                    {/* Sentence Completion */}
                    {question.type === "sentence-completion" && (
                      <Input
                        value={answers[question.id] || ""}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Type your answer here..."
                        className="bg-background/50 border-averna-primary/20"
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentPassage((prev) => Math.max(0, prev - 1))}
                disabled={currentPassage === 0}
                className="border-averna-neon text-averna-neon"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous Passage
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPassage((prev) => Math.min(test.passages.length - 1, prev + 1))}
                disabled={currentPassage === test.passages.length - 1}
                className="border-averna-neon text-averna-neon"
              >
                Next Passage
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
