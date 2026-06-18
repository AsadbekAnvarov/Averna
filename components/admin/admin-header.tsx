import { signOut } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { UserAvatarDropdown } from "@/components/user-avatar-dropdown";

interface AdminHeaderProps {
  user: { name: string | null; email: string; image?: string | null };
}

export function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 animate-fade-in">
      <Logo href="/admin/dashboard" size={40} className="text-xl" />

      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserAvatarDropdown user={{ ...user, image: user.image ?? null }} role="ADMIN" />
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
