export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PencilRuler } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { TeacherWorkshops } from "@/components/adventures/teacher-workshops";
import "@/components/adventures/adventures.css";
export const metadata = { title: "Student workshops · Teacher" };
export default async function TeacherAdventuresPage() {
  const session = await auth(); if (!session?.user) redirect("/auth/signin"); if (session.user.role !== "TEACHER") redirect(session.user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
  return <div className="min-h-screen premium-gradient"><div className="container mx-auto max-w-4xl px-4 py-6 pb-10 sm:py-8"><PageHeader className="adventure-header" back={{ href: "/teacher/dashboard", label: "Teacher dashboard" }} icon={PencilRuler} title="Student workshops" subtitle="Review original mini challenges before they reach the class." /><div className="adventure-space"><TeacherWorkshops owner={session.user.id} enabled={process.env.ADVENTURE_WORKSHOP === "on"} /></div></div></div>;
}
