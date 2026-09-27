export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teacherOf } from "@/lib/access";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { PageHeader } from "@/components/ui/page-header";
import { HomeworkCreateForm, type CreateHomeworkGroup } from "@/components/teacher/homework-create-form";

type SearchParams = Record<string, string | string[] | undefined>;
const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Set homework. ?group=<id> preselects one of the teacher's groups;
 * ?mode=classic opens the free-text form.
 */
export default async function CreateHomeworkPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");
  if (session.user.role === "STUDENT") return redirect("/dashboard");

  const teacher = await teacherOf(session.user.id);
  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="This account doesn't have a teacher profile. Sign in with a teacher account to set homework."
      />
    );
  }

  const rows: { id: string; name: string; level: string | null; _count?: { students: number } }[] = await db.group
    .findMany({
      where: { teacherId: teacher.id },
      select: { id: true, name: true, level: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    })
    .catch(() => []);
  const groups: CreateHomeworkGroup[] = rows.map((g) => ({
    id: g.id,
    name: g.name,
    level: g.level ?? null,
    students: g._count?.students ?? 0,
  }));

  const wanted = firstParam(searchParams.group);
  const defaultGroupIds = wanted && groups.some((g) => g.id === wanted) ? [wanted] : groups.length === 1 ? [groups[0].id] : [];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl px-4 py-8 pb-24 lg:pb-8">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/teacher/homework", label: "Back to Homework" }}
          icon={PlusCircle}
          iconClassName="text-averna-purple"
          title="Set homework"
          subtitle="Assign a test from the library — or write a classic task — to one or more of your groups."
        />
        <HomeworkCreateForm
          groups={groups}
          defaultGroupIds={defaultGroupIds}
          defaultMode={firstParam(searchParams.mode) === "classic" ? "classic" : "library"}
        />
      </div>
    </div>
  );
}
