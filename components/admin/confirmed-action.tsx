"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmedAction({ action, fields, label = "Oʻchirish", title, description, destructive = true }: {
  action: (data: FormData) => Promise<void>;
  fields: Record<string, string>;
  label?: string;
  title: string;
  description: string;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  return <Dialog.Root open={open} onOpenChange={value => { if (!inFlight.current) { setOpen(value); setError(""); } }}>
    <Dialog.Trigger asChild><Button type="button" size="sm" variant="outline" className={destructive ? "min-h-11 border-red-500/30 text-red-300 hover:bg-red-500/10" : "min-h-11"}>{destructive && <Trash2 className="mr-2 h-4 w-4" aria-hidden />}{label}</Button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" />
      <Dialog.Content onEscapeKeyDown={e => { if (inFlight.current) e.preventDefault(); }} onPointerDownOutside={e => { if (inFlight.current) e.preventDefault(); }} className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-background p-6 shadow-2xl">
        <Dialog.Title className="pr-8 text-lg font-semibold text-white">{title}</Dialog.Title>
        <Dialog.Description className="mt-3 text-sm leading-relaxed text-gray-400">{description}</Dialog.Description>
        <Dialog.Close asChild><button type="button" disabled={pending} aria-label="Yopish" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:text-white disabled:opacity-40"><X className="h-5 w-5" aria-hidden /></button></Dialog.Close>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <form className="mt-6 flex flex-wrap justify-end gap-3" onSubmit={async e => {
          e.preventDefault(); if (inFlight.current) return;
          inFlight.current = true; setPending(true); setError("");
          try { const data = new FormData(); Object.entries(fields).forEach(([key, value]) => data.set(key, value)); await action(data); setOpen(false); }
          catch { setError("Saqlanmadi. Birozdan keyin qayta urinib koʻring."); }
          finally { inFlight.current = false; setPending(false); }
        }}>
          <Dialog.Close asChild><Button type="button" variant="outline" disabled={pending} className="min-h-11">Bekor qilish</Button></Dialog.Close>
          <Button type="submit" disabled={pending} className={destructive ? "min-h-11 bg-red-600 text-white hover:bg-red-700" : "min-h-11"}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}{pending ? "Saqlanmoqda…" : label}</Button>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
