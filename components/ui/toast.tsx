"use client";

import { create } from "zustand";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

/** An optional one-tap action on a toast (e.g. "Undo"). The toast closes when it is used. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** Milliseconds on screen (default 4200). */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastState {
  toasts: ToastItem[];
  add: (message: string, type: ToastType, options?: ToastOptions) => number;
  remove: (id: number) => void;
}

let counter = 0;
const DURATION = 4200;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, type, options) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, ...(options?.action ? { action: options.action } : {}) }] }));
    if (typeof window !== "undefined") {
      // Lets the (opt-in) sound system chime along — see components/audio/sound-provider.tsx
      window.dispatchEvent(new CustomEvent("averna-toast", { detail: type }));
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, options?.duration ?? DURATION);
    }
    return id;
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Imperative toast API — callable from anywhere (event handlers, async code):
 *   toast.success("Saved!"); toast.error("Something went wrong");
 *   toast.success("Approved", { action: { label: "Undo", onClick }, duration: 6000 });
 * Each call returns the toast's id (toast.dismiss(id) closes it early).
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => useToastStore.getState().add(message, "success", options),
  error: (message: string, options?: ToastOptions) => useToastStore.getState().add(message, "error", options),
  info: (message: string, options?: ToastOptions) => useToastStore.getState().add(message, "info", options),
  dismiss: (id: number) => useToastStore.getState().remove(id),
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
      <p className="min-w-0 flex-1 text-sm text-white break-words leading-snug">{item.message}</p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            onClose();
            item.action?.onClick();
          }}
          className={cn(
            "-my-1 inline-flex min-h-[36px] shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60",
            accent
          )}
        >
          {item.action.label}
        </button>
      )}
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
    <div className="fixed top-[calc(4.5rem+env(safe-area-inset-top))] lg:top-4 right-[max(1rem,env(safe-area-inset-right))] z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}
