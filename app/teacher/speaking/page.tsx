export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Peer speaking" };

/** Teacher monitor for peer speaking (Phase C fills it — docs/peer-speaking.md §7). */
export default async function TeacherSpeakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = session.user.role;
  if (role !== "TEACHER" && role !== "ADMIN") redirect("/learning/speaking");
  const user = { name: session.user.name ?? (role === "ADMIN" ? "Admin" : "Teacher"), email: session.user.email ?? "" };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-4 pb-8 sm:py-6 lg:pb-6">
        {role === "ADMIN" ? <AdminHeader user={user} /> : <TeacherHeader user={user} />}
        <PageHeader
          back={{ href: role === "ADMIN" ? "/admin/dashboard" : "/teacher/dashboard", label: "Back to Dashboard" }}
          icon={Users}
          iconClassName="text-averna-pink"
          title="Peer speaking"
          subtitle="1-on-1 practice sessions between students."
        />
        <div className="av-panel rounded-2xl">
          <EmptyState
            icon={Users}
            title="Nothing here yet"
            description="Peer speaking sessions of your groups will appear here"
            action={{ label: "Open the Speaking hub", href: "/learning/speaking" }}
          />
        </div>
      </div>
    </div>
  );
}
