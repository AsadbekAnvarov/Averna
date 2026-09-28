import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
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

export async function DashboardHeader({ user, tools }: DashboardHeaderProps) {
  // Always read the freshest avatar from the DB so it updates everywhere
  const session = await auth();
  let image = user.image ?? null;
  if (session?.user?.id) {
    const u = await db.user.findUnique({ where: { id: session.user.id }, select: { image: true } });
    image = u?.image ?? image;
  }

  return (
    <header className="flex items-center gap-3 mb-4 lg:mb-6 animate-fade-in">
      {/* The mobile top app bar already shows the brand — no duplicate logo on phones. */}
      <div className="hidden lg:block"><Logo href="/dashboard" size={40} className="text-xl" /></div>

      {tools && <div className="flex min-w-0 items-center gap-4 lg:ml-auto">{tools}</div>}

      <div className="ml-auto lg:ml-0 flex items-center gap-2">
        <TashkentClock />
        <NotificationBell />
        <UserAvatarDropdown user={{ ...user, image }} role="STUDENT" />
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
