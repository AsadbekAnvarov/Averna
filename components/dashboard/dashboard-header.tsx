import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";

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
      <div className="flex items-center gap-4">
        <Logo href="/dashboard" size={40} className="text-xl" />
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <NotificationBell />

        {/* Settings */}
        <Link href="/profile">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-averna-primary/20"
          >
            <Settings className="h-5 w-5 text-gray-300" />
          </Button>
        </Link>

        {/* User Profile & Sign Out */}
        <div className="flex items-center gap-3 pl-3 border-l border-averna-primary/30">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
          
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button
              variant="outline"
              size="sm"
              className="border-averna-neon text-averna-neon hover:bg-averna-primary/20 neon-button"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
