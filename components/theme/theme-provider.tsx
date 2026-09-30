"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { THEME_COLORS } from "@/components/theme/theme-script";

export type ThemeMode = "dark" | "light";

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  const apply = useCallback((m: ThemeMode) => {
    const root = document.documentElement;
    root.classList.toggle("dark", m === "dark");
    root.classList.toggle("light", m === "light");
    // Keep the browser chrome (status bar / PWA title bar) in step with the theme.
    // Every tag, not just the first: React hydrates <meta> as a hoistable matched by its
    // `content`, so once THEME_SCRIPT has switched it to the light colour React appends a
    // second tag with the server's dark value.
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.setAttribute("content", THEME_COLORS[m]));
  }, []);

  useEffect(() => {
    try {
      const m = (localStorage.getItem("averna_theme") as ThemeMode) || "dark";
      setModeState(m);
      apply(m);
    } catch {
      apply("dark");
    }
  }, [apply]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem("averna_theme", m); } catch {}
    apply(m);
  };
  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  return <Ctx.Provider value={{ mode, setMode, toggleMode }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      mode: "dark" as ThemeMode,
      setMode: () => {},
      toggleMode: () => {},
    };
  }
  return ctx;
}
