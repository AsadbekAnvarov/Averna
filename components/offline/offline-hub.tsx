"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, CloudOff, HardDrive, Headphones, Layers, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { OFFLINE_CAP_BYTES, OFFLINE_EVENT } from "@/lib/offline/constants";
import type { OfflinePack } from "@/lib/offline/packs";
import { formatBytes, totalBytes } from "@/lib/offline/storage-cap";
import { listPacks, offlineSupported, readOwner, removeAllPacks, removePack, storageEstimate } from "@/lib/offline/store";
import { studyQueue } from "@/lib/offline/study";
import { loadSrs } from "@/lib/srs";
import { OfflineListen } from "./offline-listen";
import { OfflineReader } from "./offline-reader";
import { OfflineStudy } from "./offline-study";
import { syncInBackground, useOnline, usePendingReviews, useUserId } from "./use-offline";

/** ?pack=<id> opens one pack; ?from=<path> names the page that needed a connection. */
function readUrl(): { packId: string | null; from: string | null } {
  try {
    const params = new URL(window.location.href).searchParams;
    const from = params.get("from");
    return { packId: params.get("pack"), from: from && from.startsWith("/") && !from.startsWith("//") ? from : null };
  } catch {
    return { packId: null, from: null };
  }
}

const KIND = {
  flashcards: { icon: Layers, action: "Study", tone: "text-averna-purple" },
  article: { icon: BookOpen, action: "Read", tone: "text-averna-cyan" },
  listening: { icon: Headphones, action: "Listen", tone: "text-averna-pink" },
} as const;

const savedOn = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function dueNow(pack: OfflinePack): number | null {
  if (pack.kind !== "flashcards") return null;
  const local = loadSrs();
  const srs = { ...pack.srs };
  for (const c of pack.cards) if (local[c.key]) srs[c.key] = local[c.key];
  return studyQueue(pack.cards, srs, Date.now()).length;
}

/**
 * The offline library, /offline (idea 7): "Saved on this device". A client-rendered shell —
 * its HTML carries no personal data, so the service worker may keep it — that reads the
 * signed-in student's packs from IndexedDB and opens them (study / read / listen) with no
 * network. Views switch with history.pushState, never a server round trip.
 */
export function OfflineHub() {
  const online = useOnline();
  const userId = useUserId();
  const [owner, setOwner] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [packs, setPacks] = useState<OfflinePack[] | null>(null);
  const [estimate, setEstimate] = useState<{ quota?: number; usage?: number; persisted?: boolean }>({});
  const [packId, setPackId] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const pending = usePendingReviews(owner);

  // Signed in: this user's packs; offline (no session): the device owner's.
  useEffect(() => setOwner(userId ?? readOwner()), [userId]);

  const load = useCallback(async () => {
    const who = userId ?? readOwner();
    setPacks(await listPacks(who));
    setEstimate(await storageEstimate());
  }, [userId]);

  useEffect(() => {
    setSupported(offlineSupported());
    const url = readUrl();
    setPackId(url.packId);
    setFrom(url.from);
    void load();
    const onChange = () => void load();
    const onPop = () => setPackId(readUrl().packId);
    window.addEventListener(OFFLINE_EVENT, onChange);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener(OFFLINE_EVENT, onChange);
      window.removeEventListener("popstate", onPop);
    };
  }, [load]);

  const open = (id: string | null) => {
    window.history.pushState(null, "", id ? `/offline?pack=${encodeURIComponent(id)}` : "/offline");
    setPackId(id);
    window.scrollTo({ top: 0 });
  };

  const current = packId ? packs?.find((p) => p.id === packId) ?? null : null;
  const back = () => open(null);

  let body: React.ReactNode;
  if (current?.kind === "flashcards") body = <OfflineStudy key={current.id} pack={current} onBack={back} />;
  else if (current?.kind === "article") body = <OfflineReader key={current.id} pack={current} onBack={back} />;
  else if (current?.kind === "listening") body = <OfflineListen key={current.id} pack={current} onBack={back} />;
  else body = (
    <PackList
      packs={packs}
      supported={supported}
      online={online}
      from={from}
      pending={pending}
      estimate={estimate}
      confirmAll={confirmAll}
      onOpen={open}
      onRemove={(id) => void removePack(id)}
      onRemoveAll={() => {
        if (!confirmAll) return setConfirmAll(true);
        setConfirmAll(false);
        void removeAllPacks();
      }}
      onSync={() => syncInBackground(owner)}
    />
  );

  return (
    <div className="min-h-screen premium-gradient">
      <main className="container mx-auto max-w-3xl px-4 py-4 pb-10 sm:py-6">{body}</main>
    </div>
  );
}

function PackList({
  packs, supported, online, from, pending, estimate, confirmAll, onOpen, onRemove, onRemoveAll, onSync,
}: {
  packs: OfflinePack[] | null;
  supported: boolean;
  online: boolean;
  from: string | null;
  pending: number;
  estimate: { quota?: number; usage?: number; persisted?: boolean };
  confirmAll: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onRemoveAll: () => void;
  onSync: () => void;
}) {
  const used = packs ? totalBytes(packs) : 0;
  const share = Math.min(100, Math.round((used / OFFLINE_CAP_BYTES) * 100));

  return (
    <section aria-labelledby="offline-title">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-averna-neon">
          <HardDrive className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 id="offline-title" className="text-2xl font-bold text-white">Saved on this device</h1>
          <p className="mt-1 text-sm text-gray-400">Study, read and listen without a connection. Only you can see these, on this device.</p>
        </div>
      </div>

      {(!online || from) && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <span>
            {from ? `That page needs a connection. ` : "You're offline. "}
            Your saved lessons below still work{online ? "" : ", and your reviews sync when you're back online"}.
          </span>
        </p>
      )}

      {pending > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-200">
          <CloudOff className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <span className="min-w-0 flex-1">
            {pending} {pending === 1 ? "review is" : "reviews are"} waiting to sync.
          </span>
          {online && (
            <button type="button" onClick={onSync} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-semibold text-averna-cyan hover:bg-white/5 sm:min-h-9">
              <RefreshCw className="h-4 w-4" aria-hidden /> Sync now
            </button>
          )}
        </div>
      )}

      {!supported ? (
        <p className="glass rounded-2xl border border-white/10 p-5 text-sm text-gray-300">
          This browser can&apos;t keep lessons for offline use. Try the latest Chrome, Edge, Firefox or Safari.
        </p>
      ) : packs === null ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Loading saved lessons…</span>
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-2xl border border-white/5 bg-white/5 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : packs.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-5">
          <p className="font-semibold text-white">Nothing saved on this device yet</p>
          <p className="mt-1 text-sm text-gray-300">
            While you&apos;re online, tap “Save for offline” on a flashcard deck, an article or a recorded Listening part. It opens here
            without a connection.
          </p>
          {online && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["/flashcards", "Flashcards"],
                ["/article", "Articles"],
                ["/learning/listening", "Listening"],
              ].map(([href, label]) => (
                <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm font-medium text-gray-200 hover:border-white/20 hover:text-white">
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {packs.map((pack) => {
            const kind = KIND[pack.kind];
            const Icon = kind.icon;
            const due = dueNow(pack);
            return (
              <li key={pack.id} className="glass rounded-2xl border border-white/10 p-4">
                <div className="flex items-start gap-3">
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", kind.tone)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-base font-semibold text-white">{pack.title}</h2>
                    <p className="text-sm text-gray-400">{pack.subtitle}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Saved {savedOn(pack.savedAt)} · {formatBytes(pack.bytes)}
                      {due !== null ? ` · ${due} to study now` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(pack.id)}
                    aria-label={`${kind.action}: ${pack.title}`}
                    className="inline-flex min-h-11 items-center rounded-xl bg-averna-primary px-4 text-sm font-semibold text-white hover:bg-averna-light"
                  >
                    {kind.action}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(pack.id)}
                    aria-label={`Remove ${pack.title} from this device`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm text-gray-300 hover:border-red-400/40 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {supported && packs && packs.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-white">Storage used</span>
            <span className="text-gray-300">
              {formatBytes(used)} of {formatBytes(OFFLINE_CAP_BYTES)}
            </span>
          </div>
          <div
            role="meter"
            aria-label="Offline storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={share}
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
          >
            <div className="h-full rounded-full bg-averna-neon" style={{ width: `${share}%` }} />
          </div>
          {estimate.persisted === false && (
            <p className="mt-2 text-xs text-gray-400">Your browser may clear saved lessons when the device runs low on space.</p>
          )}
          <button
            type="button"
            onClick={onRemoveAll}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-400/30 px-3 text-sm font-medium text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> {confirmAll ? "Tap again to remove everything" : "Remove all"}
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-3 text-sm text-gray-400">
        <p>Signing out removes everything saved here.</p>
        <a href="/dashboard" className="inline-flex min-h-11 items-center font-semibold text-averna-cyan hover:underline">
          Back to Today
        </a>
      </div>
    </section>
  );
}
