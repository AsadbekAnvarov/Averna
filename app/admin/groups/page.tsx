export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, Plus, Users, Trash2 } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { recordAudit } from "@/lib/audit";
import { deleteGroupCascade } from "@/lib/cascade-delete";

const LEVELS = ["Beginner (A2)", "Intermediate (B1)", "Upper-Intermediate (B2)", "Advanced (C1)", "IELTS Standard (6.0–6.5)", "IELTS Advanced (7.5+)"];

async function createGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const name = (formData.get("name") as string)?.trim();
  const teacherId = formData.get("teacherId") as string;
  const level = (formData.get("level") as string)?.trim();
  const schedule = (formData.get("schedule") as string)?.trim();
  if (!name || !teacherId) return;

  await db.group.create({
    data: { name, teacherId, level: level || null, schedule: schedule || null, description: `${level ?? ""} group` },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Created group",
    `name=${name}`
  );
  revalidatePath("/admin/groups");
  redirect("/admin/groups?saved=1");
}

async function updateGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  const teacherId = formData.get("teacherId") as string;
  const level = (formData.get("level") as string)?.trim();
  const schedule = (formData.get("schedule") as string)?.trim();
  if (!id) return;
  await db.group.update({
    where: { id },
    data: { teacherId: teacherId || undefined, level: level || null, schedule: schedule || null },
  });
  revalidatePath("/admin/groups");
}

async function duplicateGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  const original = await db.group.findUnique({ where: { id } });
  if (!original) return;
  await db.group.create({
    data: {
      name: `${original.name} (copy)`,
      teacherId: original.teacherId,
      level: original.level,
      schedule: original.schedule,
      description: original.description,
    },
  });
  revalidatePath("/admin/groups");
  redirect("/admin/groups?saved=1");
}

async function deleteGroup(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");
  const id = formData.get("id") as string;
  if (!id) return;
  const group = await db.group.findUnique({ where: { id }, select: { name: true } });
  await deleteGroupCascade(id);
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Deleted group",
    `name=${group?.name ?? "?"}`
  );
  revalidatePath("/admin/groups");
  redirect("/admin/groups?deleted=1");
}

export default async function AdminGroupsPage({ searchParams }: { searchParams: { saved?: string; deleted?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const [groups, teachers] = await Promise.all([
    db.group.findMany({
      include: { teacher: { include: { user: { select: { name: true } } } }, students: { select: { id: true } } },
      orderBy: { name: "asc" },
    }),
    db.teacher.findMany({ include: { user: { select: { name: true } } } }),
  ]);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Back to Admin Panel" }}
          icon={Layers}
          iconClassName="text-averna-purple"
          title={<>Manage <span className="neon-text-purple">Groups</span></>}
          subtitle="Create groups, assign teachers, set levels and lesson schedules."
        />

        {searchParams.saved && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Group created!</div>}
        {searchParams.deleted && <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Group deleted.</div>}

        {/* Create group */}
        <Card className="glass border-averna-purple/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><Plus className="h-5 w-5" /> New Group</CardTitle></CardHeader>
          <CardContent>
            <form action={createGroup} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Group name *</Label>
                <Input id="name" name="name" placeholder="e.g., IELTS Advanced — Evening" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacherId">Teacher *</Label>
                <select id="teacherId" name="teacherId" required className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple">
                  {teachers.map((t) => <option key={t.id} value={t.id} className="bg-averna-dark">{t.user.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <select id="level" name="level" className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan">
                  <option value="" className="bg-averna-dark">— Level —</option>
                  {LEVELS.map((l) => <option key={l} value={l} className="bg-averna-dark">{l}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schedule">Schedule</Label>
                <Input id="schedule" name="schedule" placeholder="e.g., Mon, Wed, Fri · 18:00–20:00" className="bg-background/50" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Create Group</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Existing groups */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader><CardTitle className="text-averna-cyan">All Groups ({groups.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {groups.length === 0 ? (
              <p className="text-gray-400 text-sm">No groups yet.</p>
            ) : (
              groups.map((g) => (
                <form key={g.id} action={updateGroup} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <input type="hidden" name="id" value={g.id} />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-medium">{g.name}</p>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Users className="h-3 w-3" /> {g.students.length}</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <select name="teacherId" defaultValue={g.teacherId} className="rounded-md border border-input bg-background/60 px-2 py-2 text-xs text-white">
                      {teachers.map((t) => <option key={t.id} value={t.id} className="bg-averna-dark">{t.user.name}</option>)}
                    </select>
                    <select name="level" defaultValue={g.level ?? ""} className="rounded-md border border-input bg-background/60 px-2 py-2 text-xs text-white">
                      <option value="" className="bg-averna-dark">— Level —</option>
                      {LEVELS.map((l) => <option key={l} value={l} className="bg-averna-dark">{l}</option>)}
                    </select>
                    <Input name="schedule" defaultValue={g.schedule ?? ""} placeholder="Schedule" className="bg-background/50 h-9 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="outline" className="border-averna-cyan/40 text-averna-cyan">Save changes</Button>
                    <button formAction={duplicateGroup} className="text-xs px-3 py-1.5 rounded-md border border-averna-purple/40 text-averna-purple hover:bg-averna-purple/10">
                      Duplicate
                    </button>
                    <ConfirmButton
                      formAction={deleteGroup}
                      message={`Delete "${g.name}"? Its homework, attendance and lesson logs will be removed and ${g.students.length} student${g.students.length === 1 ? "" : "s"} will be unassigned (not deleted). This cannot be undone.`}
                      title="Delete group"
                      className="ml-auto text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </ConfirmButton>
                  </div>
                </form>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
