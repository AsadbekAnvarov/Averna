"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User,
  Save,
  Loader2,
  ArrowLeft,
  Mail,
  Target,
  Phone,
  Globe,
  GraduationCap,
  CalendarClock,
} from "lucide-react";
import Link from "next/link";

const personalGoals = [
  "IELTS 7.5+",
  "Study Abroad",
  "Work Opportunities",
  "Immigration",
  "Personal Development",
];

const targetBands = ["5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5+"];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    personalGoal: "",
    level: "",
    phone: "",
    nativeLanguage: "",
    targetBand: "",
    bio: "",
    groupName: "",
    groupLevel: "",
    groupSchedule: "",
    totalPoints: 0,
    currentStreak: 0,
    longestStreak: 0,
    globalRank: 0,
    groupRank: 0,
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setProfile((p) => ({ ...p, ...data }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          personalGoal: profile.personalGoal,
          phone: profile.phone,
          nativeLanguage: profile.nativeLanguage,
          targetBand: profile.targetBand,
          bio: profile.bio,
        }),
      });
      if (!response.ok) throw new Error("Failed to save");
      setSavedMsg("✅ Profile saved!");
      router.refresh();
    } catch (error) {
      setSavedMsg("❌ Failed to update profile");
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
          <User className="h-10 w-10 text-averna-cyan" />
          My Profile
        </h1>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="glass border-averna-primary/30">
            <CardHeader><CardTitle className="text-sm">Total Points</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-averna-neon">{profile.totalPoints}</p></CardContent>
          </Card>
          <Card className="glass border-orange-500/30">
            <CardHeader><CardTitle className="text-sm">Current Streak</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-orange-400">{profile.currentStreak}🔥</p></CardContent>
          </Card>
          <Card className="glass border-averna-purple/30">
            <CardHeader><CardTitle className="text-sm">Longest Streak</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-averna-purple">{profile.longestStreak}</p></CardContent>
          </Card>
          <Card className="glass border-averna-cyan/30">
            <CardHeader><CardTitle className="text-sm">Global Rank</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-averna-cyan">
                {profile.globalRank > 0 ? `#${profile.globalRank}` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enrollment info (set by admin) */}
        <Card className="glass border-averna-neon/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-neon">
              <GraduationCap className="h-5 w-5" /> My Enrollment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.groupName ? (
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Level</p>
                  <p className="text-white font-medium">{profile.level || profile.groupLevel || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Group</p>
                  <p className="text-white font-medium">{profile.groupName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> Schedule
                  </p>
                  <p className="text-white font-medium">{profile.groupSchedule || "—"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                ⏳ You haven&apos;t been assigned to a group yet. An administrator will enroll you soon.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Editable profile */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <CardTitle>Edit My Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Full Name
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
                  <Mail className="h-4 w-4" /> Email (read-only)
                </Label>
                <Input id="email" value={profile.email} disabled className="bg-background/50 opacity-75" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Phone
                </Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+998 ..."
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="native" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Native Language
                </Label>
                <Input
                  id="native"
                  value={profile.nativeLanguage}
                  onChange={(e) => setProfile({ ...profile, nativeLanguage: e.target.value })}
                  placeholder="e.g., Uzbek"
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4" /> Learning Goal
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
                      <SelectItem key={goal} value={goal}>{goal}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Target Band
                </Label>
                <Select
                  value={profile.targetBand}
                  onValueChange={(value) => setProfile({ ...profile, targetBand: value })}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select target band" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetBands.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-2">
                <User className="h-4 w-4" /> About Me
              </Label>
              <textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell us a bit about yourself and why you're learning English..."
                rows={4}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan"
              />
            </div>

            <div className="pt-4 border-t border-averna-primary/20 flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="neon-button bg-averna-primary hover:bg-averna-light"
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                )}
              </Button>
              {savedMsg && <span className="text-sm text-gray-300">{savedMsg}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
