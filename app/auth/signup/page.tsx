"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { USERNAME_MAX, USERNAME_TEXT, normalizeUsername } from "@/lib/account/username-rules";
import { useUsernameCheck } from "@/components/account/use-username-check";

const personalGoals = [
  "IELTS 7.5+",
  "Study Abroad",
  "Work Opportunities",
  "Immigration",
  "Personal Development",
];

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    personalGoal: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const usernameStatus = useUsernameCheck(formData.username);
  const U = USERNAME_TEXT.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!normalizeUsername(formData.username)) {
      setError(U.missing);
      return;
    }
    if (usernameStatus.state === "unavailable") {
      setError(U[usernameStatus.code]);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!formData.personalGoal) {
      setError("Please select your learning goal");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, username: normalizeUsername(formData.username) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      setSuccess(true);
      
      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        router.push("/auth/signin");
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen premium-gradient flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            Averna Learning Centre
          </h1>
          <p className="text-averna-neon">Start your IELTS journey today!</p>
        </div>

        {/* Sign Up Card */}
        <Card className="glass border-averna-primary/30 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              Join thousands of students achieving their IELTS goals
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

              {success && (
                <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Account created! Redirecting to sign in...</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">@</span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="john_smith"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    maxLength={USERNAME_MAX + 1}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={isLoading}
                    aria-describedby="username-status"
                    className="bg-background/50 pl-7"
                  />
                </div>
                <p id="username-status" aria-live="polite" className="min-h-[1rem] text-xs">
                  {usernameStatus.state === "checking" ? (
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {U.checking}
                    </span>
                  ) : usernameStatus.state === "available" ? (
                    <span className="inline-flex items-center gap-1 text-averna-neon">
                      <CheckCircle className="h-3.5 w-3.5" /> @{usernameStatus.username} — {U.available}
                    </span>
                  ) : usernameStatus.state === "unavailable" ? (
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <XCircle className="h-3.5 w-3.5" /> {U[usernameStatus.code]}
                    </span>
                  ) : usernameStatus.state === "unverified" ? (
                    <span className="text-gray-400">{U.unverified}</span>
                  ) : (
                    <span className="text-gray-400">You can sign in with it instead of your email. {U.rules}</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Why are you learning English?</Label>
                <Select
                  value={formData.personalGoal}
                  onValueChange={(value) => setFormData({ ...formData, personalGoal: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select your goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {personalGoals.map((goal) => (
                      <SelectItem key={goal} value={goal}>
                        {goal}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">
                  This helps us personalize your learning experience
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full neon-button bg-averna-primary hover:bg-averna-light"
                disabled={isLoading || success}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <div className="text-center text-sm text-gray-400">
                Already have an account?{" "}
                <Link
                  href="/auth/signin"
                  className="text-averna-neon hover:underline"
                >
                  Sign in
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
