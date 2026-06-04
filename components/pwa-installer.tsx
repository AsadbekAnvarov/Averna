"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

/**
 * Registers the service worker and shows a small "Install app" prompt
 * when the browser fires beforeinstallprompt. Fully self-contained.
 */
export function PwaInstaller() {
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      // Don't nag: only show if not dismissed this session
      if (!sessionStorage.getItem("averna_pwa_dismissed")) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem("averna_pwa_dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 glass-strong border border-averna-neon/40 rounded-xl p-3 flex items-center gap-3 shadow-neon-green animate-fade-in max-w-[90vw]">
      <div className="text-sm">
        <p className="text-white font-semibold">Install Averna</p>
        <p className="text-gray-400 text-xs">Add to your home screen for quick access</p>
      </div>
      <button onClick={install} className="neon-button bg-averna-primary hover:bg-averna-light text-white text-sm px-3 py-1.5 rounded-md flex items-center gap-1">
        <Download className="h-4 w-4" /> Install
      </button>
      <button onClick={dismiss} className="text-gray-400 hover:text-white" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
