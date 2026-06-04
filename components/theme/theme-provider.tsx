"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeMode = "dark" | "light";
export type Accent = "neon" | "cyan" | "purple" | "pink";

interface ThemeCtx {
  mode: ThemeMode;
  accent: Accent;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: Accent) => void;
  toggleMode: () => void;
}

const ACCENTS: Record<Accent, string> = {
  neon: "#00ff94",
  cyan: "#00e5ff",
  purple: "#b14eff",
  pink: "#ff3dbb",
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<Accent>("neon");

  // Apply to <html>: data attributes + a CSS var for the accent colour
  const apply = useCallback((m: ThemeMode, a: Accent) => {
    const root = document.documentElement;
    root.classList.toggle("dark", m === "dark");
    root.classList.toggle("light", m === "light");
    root.setAttribute("data-accent", a);
    root.style.setProperty("--accent", ACCENTS[a]);
  }, []);

  useEffect(() => {
    try {
      const m = (localStorage.getItem("averna_theme") as ThemeMode) || "dark";
      const a = (localStorage.getItem("averna_accent") as Accent) || "neon";
      setModeState(m);
      setAccentState(a);
      apply(m, a);
    } catch {
      apply("dark", "neon");
    }
  }, [apply]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem("averna_theme", m); } catch {}
    apply(m, accent);
  };
  const setAccent = (a: Accent) => {
    setAccentState(a);
    try { localStorage.setItem("averna_accent", a); } catch {}
    apply(mode, a);
  };
  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <Ctx.Provider value={{ mode, accent, setMode, setAccent, toggleMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      mode: "dark" as ThemeMode,
      accent: "neon" as Accent,
      setMode: () => {},
      setAccent: () => {},
      toggleMode: () => {},
    };
  }
  return ctx;
}

export const ACCENT_COLORS = ACCENTS;
