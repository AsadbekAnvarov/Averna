export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, BookOpen, Users, GraduationCap } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";

async function updateTeacherProfile(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const name = (formData.get("name") as string)?.trim();
  const bio = (formData.get("bio") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim();

  if (name) {
    await db.user.update({ where: { id: session.user.id }, data: { name } });
  }
  await db.teacher.update({
    where: { userId: session.user.id },
    data: { bio: bio || null, specialty: specialty || null },
  });

  revalidatePath("/teacher/profile");
  redirect("/teacher/dashboard");
}

export default async function TeacherProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true } },
      groups: { include: { students: true } },
      homework: true,
    },
  });

  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="This account doesn't have a teacher profile yet."
      />
    );
  }

  const totalStudents = teacher.groups.reduce((sum, g) => sum + g.students.length, 0);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <TeacherHeader user={{ name: teacher.user.name ?? "Teacher", email: teacher.user.email }} />

        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <GraduationCap className="h-10 w-10 text-averna-cyan" />
          Teacher Profile
        </h1>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="glass border-averna-cyan/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-averna-cyan">
                <Users className="h-4 w-4" /> Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-averna-cyan">{totalStudents}</p>
            </CardContent>
          </Card>
          <Card className="glass border-averna-purple/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-averna-purple">
                <BookOpen className="h-4 w-4" /> Homework Created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-averna-purple">{teacher.homework.length}</p>
            </CardContent>
          </Card>
          <Card className="glass border-averna-neon/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-averna-neon">
                <GraduationCap className="h-4 w-4" /> Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-averna-neon">{teacher.groups.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Edit form */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <CardTitle>Edit Profile &amp; Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateTeacherProfile} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={teacher.user.name ?? ""}
                  placeholder="Your full name"
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Email (read-only)</Label>
                <Input value={teacher.user.email} disabled className="bg-background/50 opacity-75" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialty" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Specialty
                </Label>
                <Input
                  id="specialty"
                  name="specialty"
                  defaultValue={teacher.specialty ?? ""}
                  placeholder="e.g., Writing & Speaking"
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Bio
                </Label>
                <textarea
                  id="bio"
                  name="bio"
                  defaultValue={teacher.bio ?? ""}
                  placeholder="Tell your students about your teaching experience..."
                  rows={4}
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan"
                />
              </div>

              <div className="pt-4 border-t border-averna-primary/20">
                <Button
                  type="submit"
                  className="w-full neon-button bg-averna-primary hover:bg-averna-light"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
