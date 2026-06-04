export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountNotice } from "@/components/account-notice";
import { getLevelInfo } from "@/lib/utils";
import { CertificateView } from "@/components/certificate-view";

export default async function CertificatePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "STUDENT") redirect("/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true } },
      group: { include: { teacher: { include: { user: { select: { name: true } } } } } },
      achievements: { include: { achievement: true } },
    },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to view your certificate." />;
  }

  const lvl = getLevelInfo(student.totalPoints);
  const issued = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <CertificateView
      name={student.user.name ?? "Student"}
      level={`Level ${lvl.level} · ${lvl.title}`}
      points={student.totalPoints}
      achievements={student.achievements.length}
      teacher={student.group?.teacher.user.name ?? "Averna Faculty"}
      groupName={student.group?.name ?? "Averna Learning Centre"}
      issued={issued}
    />
  );
}
