"use client";

import { useEffect } from "react";
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
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <CardTitle className="text-3xl font-bold text-red-500">Oops!</CardTitle>
          <p className="text-white mt-2">Something went wrong</p>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-400">
            {process.env.NODE_ENV === "production"
              ? "An unexpected error occurred. Please try again."
              : error.message || "An unexpected error occurred"}
          </p>
          <Button
            onClick={reset}
            className="w-full neon-button-error bg-red-500 hover:bg-red-600"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
