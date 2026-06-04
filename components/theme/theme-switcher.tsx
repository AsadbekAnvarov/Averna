"use client";

import { useState } from "react";
import { Sun, Moon, Palette } from "lucide-react";
import { useTheme, ACCENT_COLORS, type Accent } from "@/components/theme/theme-provider";

export function ThemeSwitcher() {
  const { mode, accent, toggleMode, setAccent } = useTheme();
  const [open, setOpen] = useState(false);

  const accents: Accent[] = ["neon", "cyan", "purple", "pink"];

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-averna-primary/20 transition-colors text-gray-300"
          aria-label="Toggle theme"
          title={mode === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {mode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        {/* Accent picker */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-averna-primary/20 transition-colors"
          aria-label="Accent colour"
          title="Accent colour"
        >
          <Palette className="h-5 w-5" style={{ color: ACCENT_COLORS[accent] }} />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 glass-strong border border-white/10 rounded-xl p-3 animate-fade-in">
            <p className="text-xs text-gray-400 mb-2">Accent colour</p>
            <div className="flex gap-2">
              {accents.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAccent(a); setOpen(false); }}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    accent === a ? "border-white" : "border-transparent"
                  }`}
                  style={{ background: ACCENT_COLORS[a] }}
                  aria-label={a}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
