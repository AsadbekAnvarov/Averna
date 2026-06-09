"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * A submit button that asks for confirmation before allowing its parent <form>
 * (a server action) to submit. Used for destructive actions like deleting a
 * teacher, student or group. Shows a spinner while the action runs.
 */
export function ConfirmButton({
  message,
  children,
  className = "",
  title,
  formAction,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="submit"
      title={title}
      formAction={formAction}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
          return;
        }
        setPending(true);
      }}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 ${className}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}
