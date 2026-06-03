import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

interface AdminHeaderProps {
  user: { name: string | null; email: string };
}

export function AdminHeader({ user }: AdminHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8 animate-fade-in">
      <Logo href="/admin/dashboard" size={40} className="text-xl" />

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-averna-purple/20 border border-averna-purple/40 text-averna-purple text-xs font-semibold">
          <ShieldCheck className="h-4 w-4" />
          Administrator
        </span>
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
