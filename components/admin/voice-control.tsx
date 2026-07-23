"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Loader2, ArrowRight } from "lucide-react";

interface Command {
  keywords: string[];
  href: string;
  label: string;
}

// Uzbek + English keywords (matched loosely against a normalised transcript).
const COMMANDS: Command[] = [
  { keywords: ["test", "generat", "yarat"], href: "/admin/generate-tests", label: "Test generatori" },
  { keywords: ["mukofot", "reward", "sovg"], href: "/admin/rewards", label: "Mukofotlar" },
  { keywords: ["moliya", "tolov", "finance", "pul", "hisob"], href: "/admin/finance", label: "Moliya" },
  { keywords: ["oqituvchi", "teacher", "ustoz"], href: "/admin/teachers", label: "Oʻqituvchilar" },
  { keywords: ["guruh", "group", "sinf"], href: "/admin/groups", label: "Guruhlar" },
  { keywords: ["elon", "announce", "xabar"], href: "/admin/announcements", label: "Eʼlonlar" },
  { keywords: ["tahlil", "analytic", "statistik"], href: "/admin/analytics", label: "Tahlil" },
  { keywords: ["kontent", "content", "dars", "material"], href: "/admin/content", label: "Kontent" },
  { keywords: ["log", "jurnal", "audit"], href: "/admin/logs", label: "Audit jurnali" },
  { keywords: ["tizim", "system", "holat", "server"], href: "/admin/system", label: "Tizim holati" },
  { keywords: ["boshqaruv", "dashboard", "asosiy", "bosh"], href: "/admin/dashboard", label: "Boshqaruv paneli" },
];

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u02bb\u02bc'`’]/g, "") // oʻ / gʻ / tutuq belgisi
    .replace(/[^a-z0-9\s]/g, " ");
}

function matchCommand(transcript: string): Command | null {
  const t = normalise(transcript);
  for (const c of COMMANDS) {
    if (c.keywords.some((k) => t.includes(k))) return c;
  }
  return null;
}

/**
 * M12 — Voice Control. The admin can speak a command (Uzbek or English) and the
 * dashboard navigates to the right place. Uses the browser SpeechRecognition
 * API; degrades gracefully where it isn't available. Uzbek UI.
 */
export function VoiceControl() {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [matched, setMatched] = useState<Command | null>(null);
  const [notFound, setNotFound] = useState(false);
  const recogRef = useRef<any>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const SR = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    setSupported(!!SR);
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
      try {
        recogRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    setTranscript("");
    setMatched(null);
    setNotFound(false);

    const recog = new SR();
    recogRef.current = recog;
    try {
      recog.lang = "uz-UZ";
    } catch {
      /* some browsers reject unknown langs */
    }
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      setTranscript(text);
      const cmd = matchCommand(text);
      if (cmd) {
        setMatched(cmd);
        navTimer.current = setTimeout(() => router.push(cmd.href), 900);
      } else {
        setNotFound(true);
      }
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);

    try {
      recog.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try {
      recogRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  return (
    <Card className="glass border-averna-pink/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-averna-pink/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-pink">
          <Mic className="h-5 w-5" /> Ovozli Boshqaruv
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {!supported ? (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <MicOff className="h-4 w-4" /> Bu brauzer ovozli buyruqni qoʻllab-quvvatlamaydi. Chrome yoki Edge dan foydalaning.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={listening ? stop : start}
              aria-label={listening ? "Toʻxtatish" : "Gapirish"}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition-all shrink-0 ${
                listening
                  ? "bg-averna-pink text-white animate-pulse shadow-[0_0_24px_rgba(236,72,153,0.5)]"
                  : "bg-averna-pink/15 text-averna-pink border border-averna-pink/40 hover:bg-averna-pink/25"
              }`}
            >
              {listening ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
            </button>

            <div className="min-w-0 flex-1">
              {!transcript && !listening && (
                <p className="text-sm text-gray-400">
                  Tugmani bosing va ayting: <span className="text-averna-pink">“Testlar”</span>,{" "}
                  <span className="text-averna-pink">“Moliya”</span>,{" "}
                  <span className="text-averna-pink">“Mukofotlar”</span>…
                </p>
              )}
              {listening && <p className="text-sm text-averna-pink">Tinglayapman…</p>}
              {transcript && (
                <p className="text-sm text-white truncate">
                  “{transcript}”
                </p>
              )}
              {matched && (
                <p className="text-xs text-averna-neon flex items-center gap-1 mt-0.5">
                  {matched.label} sahifasiga oʻtilmoqda <ArrowRight className="h-3 w-3" />
                </p>
              )}
              {notFound && !matched && (
                <p className="text-xs text-gray-500 mt-0.5">Buyruq tushunilmadi — qaytadan urinib koʻring.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
