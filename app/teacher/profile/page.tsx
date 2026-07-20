export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, BookOpen, Users, GraduationCap, CalendarClock, Layers } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { TopPerformers } from "@/components/top-performers";
import { AvatarEditor } from "@/components/avatar-editor";
import { PageHeader } from "@/components/ui/page-header";

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
      user: { select: { name: true, email: true, image: true } },
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
        <TeacherHeader user={{ name: teacher.user.name ?? "Teacher", email: teacher.user.email, image: teacher.user.image }} />

        <PageHeader
          back={{ href: "/teacher/dashboard", label: "Back to Dashboard" }}
          icon={GraduationCap}
          iconClassName="text-averna-cyan"
          title="Teacher Profile"
        />

        {/* Avatar editor */}
        <div className="mb-8">
          <AvatarEditor currentImage={teacher.user.image ?? null} name={teacher.user.name ?? "Teacher"} />
        </div>

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

        {/* My Groups - detailed list with level & schedule */}
        <Card className="glass border-averna-neon/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-neon">
              <Layers className="h-5 w-5" />
              My Groups ({teacher.groups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacher.groups.length === 0 ? (
              <p className="text-gray-400 text-sm">No groups assigned yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {teacher.groups.map((g) => (
                  <div
                    key={g.id}
                    className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-averna-neon/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-white">{g.name}</p>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/30 whitespace-nowrap">
                        {g.level ?? "Level N/A"}
                      </span>
                    </div>
                    <p className="text-sm text-averna-cyan mt-2 flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {g.schedule ?? "Schedule TBA"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {g.students.length} student{g.students.length === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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

        {/* Top performers showcase */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-4">🏆 Hall of Fame</h2>
          <TopPerformers />
        </div>
      </div>
    </div>
  );
}
