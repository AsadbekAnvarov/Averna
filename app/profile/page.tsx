"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Save, Loader2, ArrowLeft, Mail, Target } from "lucide-react";
import Link from "next/link";

const personalGoals = [
  "IELTS 7.5+",
  "Study Abroad",
  "Work Opportunities",
  "Immigration",
  "Personal Development",
];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    personalGoal: "",
    totalPoints: 0,
    currentStreak: 0,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setProfile(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          personalGoal: profile.personalGoal,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      alert("Profile updated successfully!");
      router.refresh();
    } catch (error) {
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen premium-gradient flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-averna-neon" />
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          <ArrowLeft className="h-4 w-4 inline mr-1" />
          Back to Dashboard
        </Link>

        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <User className="h-10 w-10 text-blue-400" />
          My Profile
        </h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="glass border-averna-primary/30">
            <CardHeader>
              <CardTitle className="text-sm">Total Points</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-averna-neon">{profile.totalPoints}</p>
            </CardContent>
          </Card>

          <Card className="glass border-orange-500/30">
            <CardHeader>
              <CardTitle className="text-sm">Current Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-400">{profile.currentStreak}</p>
            </CardContent>
          </Card>

          <Card className="glass border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-sm">Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-green-400">Active</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass border-blue-500/30">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Your full name"
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email (Read-only)
              </Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-background/50 opacity-75"
              />
              <p className="text-xs text-gray-400">
                Contact admin to change your email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Learning Goal
              </Label>
              <Select
                value={profile.personalGoal}
                onValueChange={(value) => setProfile({ ...profile, personalGoal: value })}
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

            <div className="pt-4 border-t border-averna-primary/20">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full neon-button bg-blue-500 hover:bg-blue-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
