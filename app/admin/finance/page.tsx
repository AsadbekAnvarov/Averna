import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
export const dynamic = "force-dynamic";
/** Old bookmarks return to administration; accounting records are preserved. */
export default async function Page() {
 const session = await auth();
 if (!session?.user) redirect("/auth/signin");
 if (session.user.role !== "ADMIN") redirect(session.user.role === "TEACHER" ? "/teacher/dashboard" : "/dashboard");
 redirect("/admin/dashboard");
}
