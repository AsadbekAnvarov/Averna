"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        // Route to the correct area based on the user's role
        const session = await getSession();
        const role = session?.user?.role;
        if (role === "TEACHER" || role === "ADMIN") {
          router.push("/teacher/dashboard");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }
    } catch (error) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen premium-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold text-white mb-2">
            Averna Learning Centre
          </h1>
          <p className="text-averna-neon">Welcome back! Sign in to continue.</p>
        </div>

        {/* Sign In Card */}
        <Card className="glass border-averna-primary/30 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="student@averna.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>

              {/* Demo Accounts Info */}
              <div className="bg-averna-primary/20 border border-averna-neon/30 rounded-lg p-3 text-sm">
                <p className="font-semibold text-averna-neon mb-1">Demo Accounts:</p>
                <ul className="text-gray-300 space-y-1 text-xs">
                  <li>👨‍🎓 Student: student1@averna.com / student123</li>
                  <li>👨‍🏫 Teacher: teacher@averna.com / teacher123</li>
                  <li>🔐 Admin: admin@averna.com / admin123</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full neon-button bg-averna-primary hover:bg-averna-light"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <div className="text-center text-sm text-gray-400">
                Don't have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="text-averna-neon hover:underline"
                >
                  Sign up
                </Link>
              </div>

              <div className="text-center">
                <Link
                  href="/"
                  className="text-sm text-gray-400 hover:text-averna-neon"
                >
                  ← Back to home
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
