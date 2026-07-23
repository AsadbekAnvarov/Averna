"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, Upload, Check, Loader2, Trash2, Sparkles, ImageIcon } from "lucide-react";
import { initialsOf } from "@/lib/utils";

/**
 * Curated, elegant preset avatars (DiceBear). Instead of a mix of cartoonish
 * styles, we use a few refined ones with a soft, cohesive gradient background so
 * the whole gallery looks neat and premium on the dark theme.
 */
// Colourful, characterful avatars (varied clothing/hair/style per seed) on a
// clean, minimalist SOLID background so the characters pop and the gallery
// stays tidy. Styles chosen for the richest outfit/style variety.
const AVATAR_BG = "eef2f7,e2e8f0,ede9fe,e0f2fe,fce7f3,fef3c7,dcfce7";
const SEEDS = ["Aria", "Leo", "Mia", "Theo", "Luna", "Kai", "Nova", "Zoe", "Remi", "Ivy", "Max", "Sage"];
const dice = (style: string, seed: string) =>
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${AVATAR_BG}&radius=50`;

const PRESET_GROUPS: { label: string; items: string[] }[] = [
  { label: "Characters", items: SEEDS.slice(0, 6).map((s) => dice("avataaars", s)) },
  { label: "Adventurers", items: SEEDS.slice(6, 12).map((s) => dice("adventurer", s)) },
  { label: "People", items: SEEDS.slice(0, 6).map((s) => dice("open-peeps", s)) },
  { label: "Personas", items: SEEDS.slice(6, 12).map((s) => dice("personas", s)) },
];

const SIZES = [
  { key: "sm", label: "Small", px: 96 },
  { key: "md", label: "Medium", px: 160 },
  { key: "lg", label: "Large", px: 256 },
] as const;

export function AvatarEditor({ currentImage, name }: { currentImage: string | null; name: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"characters" | "upload">("characters");
  const [preview, setPreview] = useState<string | null>(currentImage);
  const [size, setSize] = useState<(typeof SIZES)[number]["key"]>("md");
  const [rawFile, setRawFile] = useState<string | null>(null); // original uploaded image data
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  /** Resize/crop an image data URL to a square of `px` and return JPEG data URL. */
  const resizeTo = (src: string, px: number): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, px, px);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });

  const onFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMsg("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const data = reader.result as string;
      setRawFile(data);
      const resized = await resizeTo(data, SIZES.find((s) => s.key === size)!.px);
      setPreview(resized);
      setStatus("idle");
      setMsg("");
    };
    reader.readAsDataURL(file);
  };

  const changeSize = async (key: (typeof SIZES)[number]["key"]) => {
    setSize(key);
    if (rawFile) {
      const resized = await resizeTo(rawFile, SIZES.find((s) => s.key === key)!.px);
      setPreview(resized);
    }
  };

  const save = async (image: string | null) => {
    setStatus("saving");
    setMsg("");
    try {
      const res = await fetch("/api/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: image ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setStatus("saved");
      setMsg("✅ Avatar updated!");
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <Card className="glass border-averna-pink/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-pink">
          <UserCircle className="h-5 w-5" /> Avatar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Live preview */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-averna-neon/40 flex items-center justify-center bg-averna-dark">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-averna-neon">{initialsOf(name)}</span>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => save(preview)}
                disabled={status === "saving"}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium disabled:opacity-60"
              >
                {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save avatar
              </button>
              {currentImage && (
                <button
                  onClick={() => { setPreview(null); setRawFile(null); save(null); }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
            {msg && <p className={`text-xs text-center ${status === "error" ? "text-red-400" : "text-averna-neon"}`}>{msg}</p>}
          </div>

          {/* Tabs */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab("characters")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tab === "characters" ? "bg-averna-pink/15 text-averna-pink border border-averna-pink/40" : "text-gray-400 border border-white/10 hover:text-white"
                }`}
              >
                <Sparkles className="h-4 w-4" /> Characters
              </button>
              <button
                onClick={() => setTab("upload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tab === "upload" ? "bg-averna-cyan/15 text-averna-cyan border border-averna-cyan/40" : "text-gray-400 border border-white/10 hover:text-white"
                }`}
              >
                <ImageIcon className="h-4 w-4" /> Upload Photo
              </button>
            </div>

            {tab === "characters" ? (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                {PRESET_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">{group.label}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {group.items.map((url) => (
                        <button
                          key={url}
                          onClick={() => { setRawFile(null); setPreview(url); }}
                          className={`aspect-square rounded-full overflow-hidden border-2 transition-all hover:-translate-y-1 hover:shadow-[0_10px_28px_-10px_rgba(255,61,187,0.5)] ${
                            preview === url ? "border-averna-neon ring-2 ring-averna-neon/40" : "border-white/10 hover:border-averna-pink/50"
                          } bg-white/5`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`${group.label} avatar`} className="h-full w-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-white/15 hover:border-averna-cyan/40 text-gray-400 hover:text-white transition-colors"
                >
                  <Upload className="h-7 w-7" />
                  <span className="text-sm">Click to choose a photo</span>
                  <span className="text-xs text-gray-500">JPG or PNG — auto-cropped to a square</span>
                </button>

                {rawFile && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-2">Choose size</p>
                    <div className="flex gap-2">
                      {SIZES.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => changeSize(s.key)}
                          className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                            size === s.key ? "border-averna-cyan/50 bg-averna-cyan/15 text-averna-cyan" : "border-white/10 text-gray-300 hover:text-white"
                          }`}
                        >
                          {s.label}
                          <span className="block text-[10px] text-gray-500">{s.px}px</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
