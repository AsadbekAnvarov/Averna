export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { calibrationEnabled, ToolError } from "@/lib/teacher-tools/rules";
import { getCalibration } from "@/lib/teacher-tools/calibration";
import { Calibration } from "@/components/teacher-tools/calibration";
export const metadata = { title: "Private assessment calibration" };
export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ reference?: string; page?: string }> }) {
  if (!calibrationEnabled()) notFound(); const session = await auth(); if (!session?.user) redirect("/auth/signin"); if (!["ADMIN", "TEACHER"].includes(session.user.role)) notFound();
  const params = await searchParams; let view; try { view = await getCalibration(session.user, params.reference, Number(params.page ?? 1)); } catch (e) { if (e instanceof ToolError && [403, 404].includes(e.status)) notFound(); throw e; }
  return <main className="min-h-screen premium-gradient"><div className="container mx-auto max-w-5xl space-y-6 px-4 py-6 sm:py-8"><Link href={session.user.role === "ADMIN" ? "/admin/dashboard" : "/teacher/reviews"} className="inline-flex min-h-11 items-center text-sm text-averna-cyan">← Back to workspace</Link><Calibration key={view.selected?.id ?? "empty"} initial={view} /></div></main>;
}
