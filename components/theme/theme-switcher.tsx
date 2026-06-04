"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";

export function ThemeSwitcher() {
  const { mode, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-averna-primary/20 transition-colors text-gray-300"
      aria-label="Toggle theme"
      title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
