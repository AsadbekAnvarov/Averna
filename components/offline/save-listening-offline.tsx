"use client";

import { useEffect, useState } from "react";
import type { ClientListeningTest } from "@/lib/ielts/types";
import { OFFLINE_CAP_BYTES } from "@/lib/offline/constants";
import { packIds } from "@/lib/offline/packs";
import { estimateAudioBytes, probeAudio, saveListeningPart, type AudioProbe } from "@/lib/offline/save";
import { clipBytesEstimate, loadSegmentClip } from "@/components/exam/segment-clip";
import { SaveOfflineButton } from "./save-offline-button";

/**
 * "Save for offline" on one recorded Listening practice part (idea 7): the recording and the
 * part's questions. The size shows before saving. A recording whose host doesn't let this
 * site read it (CORS) is not saved at all, and the button says so. One part of a whole
 * recording saves only its own frame-exact clip (the segment's bytes + a header frame).
 */
export function SaveListeningOffline({
  test,
  partIndex,
  className,
  clip,
}: {
  test: ClientListeningTest;
  partIndex: number;
  className?: string;
  /** The part clip the runner already built (saves downloading it again). */
  clip?: Blob | null;
}) {
  const part = test.parts[partIndex];
  const audio = part?.audio;
  const segment = audio?.segment;
  const [probe, setProbe] = useState<AudioProbe | null>(null);

  useEffect(() => {
    if (segment || !audio?.url || navigator.onLine === false) return;
    let alive = true;
    void probeAudio(audio.url, audio.durationMs).then((p) => {
      if (alive) setProbe(p);
    });
    return () => {
      alive = false;
    };
  }, [audio?.url, audio?.durationMs, segment]);

  if (!part || !audio) return null;
  const bytes = segment ? clipBytesEstimate(segment) : probe?.ok ? probe.bytes : estimateAudioBytes(audio.durationMs);
  const unavailable =
    !segment && probe && !probe.ok
      ? "This recording can't be saved for offline use: its audio host doesn't allow it. Listen online instead."
      : bytes > OFFLINE_CAP_BYTES
        ? "This recording is too large to save for offline use."
        : null;

  return (
    <SaveOfflineButton
      className={className}
      packId={packIds.listening(test.id, partIndex)}
      label={`Save ${part.title} for offline`}
      bytes={bytes}
      estimated={segment ? false : !probe?.ok || !probe.exact}
      unavailable={unavailable}
      onSave={(owner) =>
        saveListeningPart(owner, {
          testId: test.id,
          testTitle: test.title,
          partIndex,
          partTitle: part.title,
          context: part.context,
          groups: part.groups,
          audio: segment
            ? {
                url: audio.url,
                durationMs: audio.durationMs,
                file: `${audio.url}?averna-part=${partIndex + 1}`,
                clip: async () => {
                  if (clip) return clip;
                  const r = await loadSegmentClip({ ...segment, url: audio.url });
                  return r.mode === "clip" ? r.bytes : null;
                },
              }
            : { url: audio.url, durationMs: audio.durationMs },
        })
      }
    />
  );
}
