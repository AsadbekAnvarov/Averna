"use client";

import { useRef, useState } from "react";

/**
 * One recorded Speaking answer.
 *
 * Browser-recorded WebM files carry no duration, so Chrome can't seek in them
 * until it has read the whole file. On the first Play the player makes the
 * browser work the length out (a jump to the end and back), then plays from
 * the start with a working seek bar. Nothing is downloaded before Play
 * (preload="none"). A browser that can't play the format gets a download link.
 */
export function RecordingPlayer({ src, label, durationLabel }: { src: string; label: string; durationLabel?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const fixedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  const onPlay = () => {
    const a = ref.current;
    if (!a || fixedRef.current) return;
    fixedRef.current = true;
    if (Number.isFinite(a.duration) && a.duration > 0) return;
    a.pause();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      a.removeEventListener("durationchange", onChange);
      window.clearTimeout(timer);
      try {
        a.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      void a.play().catch(() => undefined);
    };
    const onChange = () => {
      if (Number.isFinite(a.duration)) finish();
    };
    const timer = window.setTimeout(finish, 4000);
    a.addEventListener("durationchange", onChange);
    try {
      a.currentTime = 1e101;
    } catch {
      finish();
    }
  };

  if (failed) {
    return (
      <p className="text-xs text-gray-400">
        This browser can&apos;t play the recording.{" "}
        <a href={src} download className="font-medium text-averna-neon underline underline-offset-2 hover:text-white">
          Download it
        </a>{" "}
        to listen.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <audio
        ref={ref}
        controls
        preload="none"
        src={src}
        aria-label={label}
        onPlay={onPlay}
        onError={() => setFailed(true)}
        className="h-10 min-w-0 flex-1 [color-scheme:dark]"
      >
        <a href={src}>Download the recording</a>
      </audio>
      {durationLabel && <span className="shrink-0 text-xs tabular-nums text-gray-400">{durationLabel}</span>}
    </div>
  );
}
