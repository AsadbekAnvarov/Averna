export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Plus, Users, Layers, Trash2 } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { recordAudit } from "@/lib/audit";
import { deleteTeacherCascade } from "@/lib/cascade-delete";

async function addTeacher(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = (formData.get("password") as string) || "";
  const specialty = (formData.get("specialty") as string)?.trim();
  const isSecond = formData.get("isSecond") === "on";
  if (!name || !email || password.length < 6) {
    redirect("/admin/teachers?error=invalid");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) redirect("/admin/teachers?error=exists");

  const user = await db.user.create({
    data: {
      name,
      email,
      password: await hash(password, 12),
      role: "TEACHER",
      emailVerified: new Date(),
    },
  });
  await db.teacher.create({
    data: { userId: user.id, specialty: specialty || null, isSecondTeacher: isSecond },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Created teacher",
    `name=${name} email=${email}`
  );

  revalidatePath("/admin/teachers");
  redirect("/admin/teachers?saved=1");
}

async function deleteTeacher(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const teacherId = formData.get("teacherId") as string;
  if (!teacherId) return;

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    include: { user: { select: { name: true, email: true } } },
  });

  await deleteTeacherCascade(teacherId);
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Deleted teacher",
    `name=${teacher?.user.name ?? "?"} email=${teacher?.user.email ?? "?"}`
  );

  revalidatePath("/admin/teachers");
  redirect("/admin/teachers?deleted=1");
}

export default async function AdminTeachersPage({ searchParams }: { searchParams: { saved?: string; error?: string; deleted?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const teachers = await db.teacher.findMany({
    include: {
      user: { select: { name: true, email: true } },
      groups: { include: { students: { select: { id: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Back to Admin Panel" }}
          icon={GraduationCap}
          iconClassName="text-averna-purple"
          title={<>Manage <span className="neon-text-purple">Teachers</span></>}
          subtitle="Add teachers and see their groups & student counts."
        />

        {searchParams.saved && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Teacher added!</div>}
        {searchParams.deleted && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Teacher deleted.</div>}
        {searchParams.error === "exists" && <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">A user with that email already exists.</div>}
        {searchParams.error === "invalid" && <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">Please fill all fields (password ≥ 6 chars).</div>}

        {/* Add teacher */}
        <Card className="glass border-averna-purple/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><Plus className="h-5 w-5" /> Add Teacher</CardTitle></CardHeader>
          <CardContent>
            <form action={addTeacher} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" placeholder="e.g., John Carter" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="teacher@averna.com" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" name="password" placeholder="min 6 characters" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty</Label>
                <Input id="specialty" name="specialty" placeholder="e.g., Writing & Speaking" className="bg-background/50" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
                <input type="checkbox" name="isSecond" className="accent-averna-primary" />
                Second teacher (offers 1-on-1 tutoring)
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Create Teacher Account</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Teacher list */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader><CardTitle className="text-averna-cyan">All Teachers ({teachers.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {teachers.map((t) => {
              const students = t.groups.reduce((s, g) => s + g.students.length, 0);
              return (
                <div key={t.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">
                        {t.user.name}
                        {t.isSecondTeacher && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-averna-pink/20 text-averna-pink border border-averna-pink/30">1-on-1</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{t.user.email} · {t.specialty ?? "IELTS Instructor"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {t.groups.length}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {students}</span>
                      </div>
                      <form action={deleteTeacher}>
                        <input type="hidden" name="teacherId" value={t.id} />
                        <ConfirmButton
                          message={`Delete ${t.user.name}? Their groups will be removed and ${students} student${students === 1 ? "" : "s"} will be unassigned (not deleted). This cannot be undone.`}
                          title="Delete teacher"
                          className="h-8 w-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
