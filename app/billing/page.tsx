export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Retain old bookmarks, but retire the student billing UI and demo mutations. */
export default async function LegacyBillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  redirect("/dashboard");
}
