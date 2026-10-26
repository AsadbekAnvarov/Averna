"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Opt-in captions of the student's OWN speech (Web Speech API, en-GB), shown only to
 * them. The transcript lives in memory only — never stored or sent by Averna (the
 * browser's speech service may process audio online; the UI says so).
 */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface OwnCaptions {
  supported: boolean;
  on: boolean;
  setOn: (on: boolean) => void;
  /** Final text so far (this session, memory only). */
  transcript: string;
  interim: string;
  error: string | null;
}

export function useOwnCaptions(lang = "en-GB"): OwnCaptions {
  const [supported, setSupported] = useState(false);
  const [on, setOnState] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const want = useRef(false);

  useEffect(() => setSupported(!!recognitionCtor()), []);

  const stop = useCallback(() => {
    want.current = false;
    const r = rec.current;
    rec.current = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      try {
        r.abort();
      } catch {
        /* not running */
      }
    }
    setInterim("");
  }, []);

  const begin = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      const finals: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.push(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      if (finals.length) setTranscript((t) => `${t} ${finals.filter(Boolean).join(" ")}`.trim());
      setInterim(live.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        want.current = false;
        setOnState(false);
        setError("Captions need microphone permission for speech recognition.");
      }
    };
    // Browsers stop recognising after a pause; keep going while captions are on.
    r.onend = () => {
      if (want.current && rec.current === r) {
        try {
          r.start();
        } catch {
          want.current = false;
          setOnState(false);
        }
      }
    };
    rec.current = r;
    try {
      r.start();
    } catch {
      setError("Captions could not start in this browser.");
      want.current = false;
      setOnState(false);
    }
  }, [lang]);

  const setOn = useCallback(
    (next: boolean) => {
      setError(null);
      setOnState(next);
      if (next) {
        want.current = true;
        begin();
      } else stop();
    },
    [begin, stop],
  );

  useEffect(() => stop, [stop]);

  return { supported, on, setOn, transcript, interim, error };
}
