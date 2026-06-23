"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme/theme-provider";
import {
  User, Settings, Sun, Moon, LogOut, ChevronDown,
  Shield, GraduationCap, Palette,
} from "lucide-react";

interface Props {
  user: { name: string | null; email: string; image?: string | null };
  role: "STUDENT" | "TEACHER" | "ADMIN";
}

/**
 * User avatar with dropdown menu. Shows user photo or initials, and on click
 * opens a compact menu: Profile, Settings, Theme toggle, Sign out.
 * Works for all roles — the links adapt accordingly.
 */
export function UserAvatarDropdown({ user, role }: Props) {
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const profileHref =
    role === "ADMIN" ? "/admin/profile" :
    role === "TEACHER" ? "/teacher/profile" :
    "/profile";

  const initials = (user.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleBadge =
    role === "ADMIN" ? { icon: Shield, label: "Admin", cls: "bg-averna-purple/20 text-averna-purple" } :
    role === "TEACHER" ? { icon: GraduationCap, label: "Teacher", cls: "bg-averna-cyan/20 text-averna-cyan" } :
    null;

  const handleSignOut = () => {
    setOpen(false);
    const form = document.getElementById("signout-form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 p-1.5 rounded-full hover:bg-white/5 transition-colors"
        aria-label="User menu"
      >
        <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-averna-neon/40 flex items-center justify-center bg-averna-dark shrink-0">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name ?? "Avatar"} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-averna-neon">{initials}</span>
          )}
        </div>
        <div className="hidden md:block text-left min-w-0">
          <p className="text-sm font-medium text-white truncate max-w-[130px]">{user.name}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 hidden md:block transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 glass-strong border border-white/10 rounded-xl shadow-2xl z-50 animate-fade-in overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-averna-neon/40 flex items-center justify-center bg-averna-dark shrink-0">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={user.name ?? "Avatar"} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base font-bold text-averna-neon">{initials}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            {roleBadge && (
              <span className={`inline-flex items-center gap-1 mt-2 text-[10px] px-2 py-0.5 rounded-full font-semibold ${roleBadge.cls}`}>
                <roleBadge.icon className="h-3 w-3" /> {roleBadge.label}
              </span>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <DropItem icon={User} label="My Profile" onClick={() => { setOpen(false); router.push(profileHref); }} />
            <DropItem icon={Settings} label="Settings" onClick={() => { setOpen(false); router.push(profileHref); }} />
            <DropItem icon={Palette} label="Edit Avatar" onClick={() => { setOpen(false); router.push(profileHref); }} />
            <div className="border-t border-white/10 my-1.5 mx-3" />
            <button
              onClick={toggleMode}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors"
            >
              {mode === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-averna-purple" />}
              <span>{mode === "dark" ? "Light Mode" : "Dark Mode"}</span>
              <span className="ml-auto text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5">
                {mode === "dark" ? "☀️" : "🌙"}
              </span>
            </button>
            <div className="border-t border-white/10 my-1.5 mx-3" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors"
    >
      <Icon className="h-4 w-4 text-gray-400" />
      <span>{label}</span>
    </button>
  );
}
