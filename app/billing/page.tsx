export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Student Billing has been retired. Keep old bookmarks safe without reading or
 * changing balances/payments. The former demo checkout server actions are removed.
 * Admin finance remains at /admin/finance and is not affected by this route.
 */
export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  redirect("/dashboard");
}
