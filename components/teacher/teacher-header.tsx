import { signOut } from "@/lib/auth";
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

export function TeacherHeader({ user }: TeacherHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 animate-fade-in">
      <Logo href="/teacher/dashboard" size={40} className="text-xl" />

      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserAvatarDropdown user={{ ...user, image: user.image ?? null }} role="TEACHER" />
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
