"use client";

import { Captions, CaptionsOff, Mic, MicOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

const BTN =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon";

/**
 * Mute · captions · End for a live call. 44 px targets everywhere; Mute and the
 * captions toggle are pressed-state buttons; End is red and labelled in words.
 * Keyboard (handled by the call screen): Space mutes, Esc asks to end.
 */
export function CallControls({
  muted,
  onToggleMute,
  captionsOn,
  onToggleCaptions,
  onEnd,
  disabled = false,
}: {
  muted: boolean;
  onToggleMute: () => void;
  captionsOn: boolean;
  onToggleCaptions: () => void;
  onEnd: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Call controls">
      <button
        type="button"
        onClick={onToggleMute}
        disabled={disabled}
        aria-pressed={muted}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        aria-keyshortcuts="Space"
        className={cn(BTN, "flex-1 sm:flex-none", muted ? "bg-amber-400/20 text-amber-300 hover:bg-amber-400/30" : "border border-white/20 text-white hover:bg-white/10", "disabled:opacity-50")}
      >
        {muted ? <MicOff aria-hidden className="h-5 w-5" /> : <Mic aria-hidden className="h-5 w-5" />}
        <span>{muted ? "Unmute" : "Mute"}</span>
      </button>
      <button
        type="button"
        onClick={onToggleCaptions}
        aria-pressed={captionsOn}
        className={cn(BTN, "flex-1 border border-white/20 text-white hover:bg-white/10 sm:flex-none")}
      >
        {captionsOn ? <Captions aria-hidden className="h-5 w-5" /> : <CaptionsOff aria-hidden className="h-5 w-5" />}
        <span>Show captions</span>
      </button>
      <button
        type="button"
        onClick={onEnd}
        disabled={disabled}
        aria-label="End call"
        aria-keyshortcuts="Escape"
        className={cn(BTN, "w-full border border-red-400/60 bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-50 sm:w-auto")}
      >
        <PhoneOff aria-hidden className="h-5 w-5" />
        <span>End call</span>
      </button>
    </div>
  );
}
