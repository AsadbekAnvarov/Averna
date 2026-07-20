"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  add: (message: string, type: ToastType) => void;
  remove: (id: number) => void;
}

let counter = 0;
const DURATION = 4200;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, type) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, DURATION);
    }
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Imperative toast API — callable from anywhere (event handlers, async code):
 *   toast.success("Saved!"); toast.error("Something went wrong");
 */
export const toast = {
  success: (message: string) => useToastStore.getState().add(message, "success"),
  error: (message: string) => useToastStore.getState().add(message, "error"),
  info: (message: string) => useToastStore.getState().add(message, "info"),
};

const STYLES: Record<ToastType, { icon: typeof Info; accent: string; bar: string }> = {
  success: { icon: CheckCircle2, accent: "text-averna-neon", bar: "bg-averna-neon" },
  error: { icon: AlertCircle, accent: "text-red-400", bar: "bg-red-400" },
  info: { icon: Info, accent: "text-averna-cyan", bar: "bg-averna-cyan" },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { icon: Icon, accent, bar } = STYLES[item.type];
  return (
    <div
      role="status"
      className="pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-xl glass-strong border border-white/10 shadow-lg p-3 pr-9 animate-fade-in"
    >
      <span className={cn("absolute left-0 top-0 h-full w-1", bar)} aria-hidden />
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", accent)} />
      <p className="text-sm text-white break-words leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Global toast container. Mounted once (in Providers). Renders top-right,
 * clear of the mobile menu button (top-left) and the Quick-jump FAB (bottom).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}
