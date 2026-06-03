"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Search, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen premium-gradient flex items-center justify-center px-4">
      <Card className="glass border-averna-primary/30 max-w-2xl w-full animate-fade-in">
        <CardHeader className="text-center">
          <div className="text-9xl font-bold text-averna-neon mb-4">404</div>
          <CardTitle className="text-4xl font-bold text-white mb-2">
            Page Not Found
          </CardTitle>
          <p className="text-gray-400 text-lg">
            Oops! The page you're looking for doesn't exist.
          </p>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="bg-averna-primary/20 rounded-lg p-6 border border-averna-primary/30">
            <Search className="h-16 w-16 text-averna-neon mx-auto mb-3 opacity-50" />
            <p className="text-gray-300 text-sm">
              The page might have been moved, deleted, or never existed in the first place.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/dashboard" className="flex-1">
              <Button className="w-full neon-button bg-averna-primary hover:bg-averna-light">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="flex-1 border-averna-neon text-averna-neon"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>

          <div className="pt-6 border-t border-averna-primary/20">
            <p className="text-sm text-gray-400 mb-3">Quick Links:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link href="/learning/writing">
                <Button size="sm" variant="ghost" className="text-purple-400 hover:bg-purple-500/20">
                  Writing
                </Button>
              </Link>
              <Link href="/learning/reading">
                <Button size="sm" variant="ghost" className="text-blue-400 hover:bg-blue-500/20">
                  Reading
                </Button>
              </Link>
              <Link href="/homework">
                <Button size="sm" variant="ghost" className="text-green-400 hover:bg-green-500/20">
                  Homework
                </Button>
              </Link>
              <Link href="/rankings">
                <Button size="sm" variant="ghost" className="text-yellow-400 hover:bg-yellow-500/20">
                  Rankings
                </Button>
              </Link>
              <Link href="/mentor">
                <Button size="sm" variant="ghost" className="text-pink-400 hover:bg-pink-500/20">
                  AI Mentor
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
