export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TeacherSpeakingPractice } from "@/components/learning/teacher-speaking-practice";
export default async function SpeakingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  return <TeacherSpeakingPractice teacher={session.user.role === "TEACHER" || session.user.role === "ADMIN"} />;
}
