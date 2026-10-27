"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { wipeOfflineData } from "@/lib/offline/store";

/**
 * The submit button of a server-action sign-out form: wipes this device's offline packs and
 * waiting grades first (idea 7), then submits the form.
 */
export function SignOutSubmit({ children, className }: { children: ReactNode; className?: string }) {
  const wiped = useRef(false);
  return (
    <Button
      type="submit"
      className={className}
      onClick={(event) => {
        if (wiped.current) return;
        event.preventDefault();
        const form = event.currentTarget.form;
        void wipeOfflineData().finally(() => {
          wiped.current = true;
          form?.requestSubmit();
        });
      }}
    >
      {children}
    </Button>
  );
}
