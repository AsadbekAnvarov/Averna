"use client";

import { useEffect, useState } from "react";
import type { ClientListeningTest } from "@/lib/ielts/types";
import { OFFLINE_CAP_BYTES } from "@/lib/offline/constants";
import { packIds } from "@/lib/offline/packs";
import { estimateAudioBytes, probeAudio, saveListeningPart, type AudioProbe } from "@/lib/offline/save";
import { SaveOfflineButton } from "./save-offline-button";

/**
 * "Save for offline" on one recorded Listening practice part (idea 7): the recording and the
 * part's questions. The size shows before saving. A recording whose host doesn't let this
 * site read it (CORS) is not saved at all, and the button says so.
 */
export function SaveListeningOffline({ test, partIndex, className }: { test: ClientListeningTest; partIndex: number; className?: string }) {
  const part = test.parts[partIndex];
  const audio = part?.audio;
  const [probe, setProbe] = useState<AudioProbe | null>(null);

  useEffect(() => {
    if (!audio?.url || navigator.onLine === false) return;
    let alive = true;
    void probeAudio(audio.url, audio.durationMs).then((p) => {
      if (alive) setProbe(p);
    });
    return () => {
      alive = false;
    };
  }, [audio?.url, audio?.durationMs]);

  if (!part || !audio) return null;
  const bytes = probe?.ok ? probe.bytes : estimateAudioBytes(audio.durationMs);
  const unavailable =
    probe && !probe.ok
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
      estimated={!probe?.ok || !probe.exact}
      unavailable={unavailable}
      onSave={(owner) =>
        saveListeningPart(owner, {
          testId: test.id,
          testTitle: test.title,
          partIndex,
          partTitle: part.title,
          context: part.context,
          groups: part.groups,
          audio: { url: audio.url, durationMs: audio.durationMs },
        })
      }
    />
  );
}
