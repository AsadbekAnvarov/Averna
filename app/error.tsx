"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen premium-gradient flex items-center justify-center px-4">
      <Card className="glass border-red-500/30 max-w-md w-full animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 shadow-[0_0_24px_-8px_rgba(248,113,113,0.6)]">
            <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Something went wrong.</CardTitle>
          <p className="text-gray-300 mt-2">This page didn&apos;t load. Your progress and XP are safe.</p>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-400">
            {process.env.NODE_ENV === "production"
              ? "Try again — if it keeps happening, go back to your dashboard."
              : error.message || "An unexpected error occurred"}
          </p>
          <Button
            onClick={reset}
            className="w-full min-h-[44px] bg-red-500/90 hover:bg-red-500 text-white"
          >
            Try Again
          </Button>
          <Link href="/dashboard" className="block text-sm text-gray-300 hover:text-white underline-offset-4 hover:underline">
            Back to my dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
