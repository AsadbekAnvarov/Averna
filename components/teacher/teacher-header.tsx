import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { UserAvatarDropdown } from "@/components/user-avatar-dropdown";

interface TeacherHeaderProps {
  user: {
    name: string | null;
    email: string;
    image?: string | null;
  };
}

export async function TeacherHeader({ user }: TeacherHeaderProps) {
  const session = await auth();
  let image = user.image ?? null;
  if (session?.user?.id) {
    const u = await db.user.findUnique({ where: { id: session.user.id }, select: { image: true } });
    image = u?.image ?? image;
  }

  return (
    <header className="flex items-center justify-between mb-8 animate-fade-in">
      <Logo href="/teacher/dashboard" size={40} className="text-xl" />

      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserAvatarDropdown user={{ name: user.name, email: user.email, image }} role="TEACHER" />
      </div>

      {/* Hidden sign-out form for the dropdown */}
      <form
        id="signout-form"
        className="hidden"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      />
    </header>
  );
}
