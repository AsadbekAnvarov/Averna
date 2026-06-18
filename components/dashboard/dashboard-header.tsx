import { signOut } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { TashkentClock } from "@/components/tashkent-clock";
import { UserAvatarDropdown } from "@/components/user-avatar-dropdown";

interface DashboardHeaderProps {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6 animate-fade-in">
      <Logo href="/dashboard" size={40} className="text-xl" />

      <div className="flex items-center gap-2">
        <TashkentClock />
        <NotificationBell />
        <UserAvatarDropdown user={user} role="STUDENT" />
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
