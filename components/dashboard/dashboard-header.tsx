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
  /** Small page tools (Customize, live refresh…) — left on phones, right on desktop. */
  tools?: React.ReactNode;
}

/**
 * Student dashboard header: logo, page tools, clock, notifications and the
 * avatar menu. The caller (app/dashboard/layout.tsx) passes a fresh user row,
 * read from the DB in this same request, so the avatar is used as-is with no
 * second lookup.
 */
export function DashboardHeader({ user, tools }: DashboardHeaderProps) {
  return (
    <header className="flex items-center gap-3 mb-4 lg:mb-6 animate-fade-in">
      {/* The mobile top app bar already shows the brand — no duplicate logo on phones. */}
      <div className="hidden lg:block"><Logo href="/dashboard" size={40} className="text-xl" /></div>

      {tools && <div className="flex min-w-0 items-center gap-4 lg:ml-auto">{tools}</div>}

      <div className="ml-auto lg:ml-0 flex items-center gap-2">
        <TashkentClock />
        <NotificationBell />
        {/* Only the fields the client menu needs: the caller's row is the full user record. */}
        <UserAvatarDropdown user={{ name: user.name, email: user.email, image: user.image }} role="STUDENT" />
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
