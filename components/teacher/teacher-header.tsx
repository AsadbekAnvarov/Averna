import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

interface TeacherHeaderProps {
  user: {
    name: string | null;
    email: string;
  };
}

export function TeacherHeader({ user }: TeacherHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 animate-fade-in">
      <Logo href="/teacher/dashboard" size={40} className="text-xl" />

      <div className="flex items-center gap-3">
        <Link href="/teacher/profile">
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-averna-primary/20 text-gray-200"
          >
            <User className="mr-2 h-4 w-4" />
            <span className="hidden md:inline">Profile</span>
          </Button>
        </Link>

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
