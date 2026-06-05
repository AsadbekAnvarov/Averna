export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { GradingAssistant } from "@/components/teacher/grading-assistant";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

export default async function GradingAssistantPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />

        <Link href="/teacher/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-averna-purple" />
          Grading <span className="neon-text-purple">Assistant</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Paste a student&apos;s writing to get an instant suggested band, criteria breakdown and an editable
          feedback draft — refine it by typing or dictating, then copy it into your grade. 🤖
        </p>

        <GradingAssistant />
      </div>
    </div>
  );
}
