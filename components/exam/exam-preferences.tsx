"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
export function ExamThemeToggle() {
 const {mode,toggleMode}=useTheme();
 return <button type="button" onClick={toggleMode} aria-label={mode==="dark"?"Switch exam to light theme":"Switch exam to dark theme"} title={mode==="dark"?"Light theme":"Dark theme"} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-gray-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon"><span aria-hidden>{mode==="dark"?<Sun className="h-5 w-5"/>:<Moon className="h-5 w-5"/>}</span></button>;
}
export const HIGHLIGHT_COLORS=[{id:"yellow",label:"Yellow",fill:"rgba(234,179,8,.3)"},{id:"blue",label:"Blue",fill:"rgba(96,165,250,.3)"},{id:"green",label:"Green",fill:"rgba(74,222,128,.3)"},{id:"pink",label:"Pink",fill:"rgba(244,114,182,.3)"}] as const;
export type HighlightColor=typeof HIGHLIGHT_COLORS[number]["id"];
