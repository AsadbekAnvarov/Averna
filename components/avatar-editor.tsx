"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCircle, Upload, Check, Loader2, Trash2, Users, Sparkles, ImageIcon } from "lucide-react";
import { initialsOf } from "@/lib/utils";
import { AVATAR_GROUPS, avatarSrc } from "@/lib/avatars";

/**
 * Avatar picker: Averna's own preset gallery (illustrated "Students" and
 * abstract "Aurora" orbs, self-hosted in public/avatars) or an uploaded photo,
 * with a live preview. Works for every role.
 */

const SIZES = [
  { key: "sm", label: "Small", px: 96 },
  { key: "md", label: "Medium", px: 160 },
  { key: "lg", label: "Large", px: 256 },
] as const;

type Tab = "students" | "aurora" | "upload";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "students", label: "Students", icon: Users },
  { key: "aurora", label: "Aurora", icon: Sparkles },
  { key: "upload", label: "Photo", icon: ImageIcon },
];

export function AvatarEditor({ currentImage, name }: { currentImage: string | null; name: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = avatarSrc(currentImage);
  const [tab, setTab] = useState<Tab>(initial?.includes("/avatars/aurora-") ? "aurora" : "students");
  const [preview, setPreview] = useState<string | null>(initial);
  const [size, setSize] = useState<(typeof SIZES)[number]["key"]>("md");
  const [rawFile, setRawFile] = useState<string | null>(null); // original uploaded image data
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  const dirty = preview !== initial || (currentImage !== null && currentImage !== initial);

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
      setMsg(image ? "Avatar updated" : "Avatar removed");
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const group = AVATAR_GROUPS.find((g) => g.key === tab);

  return (
    <Card id="avatar" className="glass border-averna-pink/30 scroll-mt-24">
      <CardHeader className="p-5 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-averna-pink">
          <UserCircle className="h-5 w-5" /> Avatar
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Live preview + actions */}
          <div className="flex items-center gap-4 md:w-40 md:shrink-0 md:flex-col md:items-stretch">
            <div className="mx-0 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-averna-neon/40 bg-averna-dark shadow-lg shadow-averna-neon/10 flex items-center justify-center md:mx-auto md:h-32 md:w-32">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Avatar preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-averna-neon">{initialsOf(name)}</span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                onClick={() => save(preview)}
                disabled={status === "saving" || !dirty}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-averna-primary/80 px-4 py-2.5 text-sm font-medium text-white hover:bg-averna-primary disabled:opacity-50"
              >
                {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save avatar
              </button>
              {currentImage && (
                <button
                  onClick={() => { setPreview(null); setRawFile(null); save(null); }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
              {msg && (
                <p role="status" className={`text-xs md:text-center ${status === "error" ? "text-red-400" : "text-averna-neon"}`}>{msg}</p>
              )}
            </div>
          </div>

          {/* Gallery */}
          <div className="min-w-0 flex-1">
            <div role="tablist" aria-label="Avatar source" className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                    tab === key ? "bg-white/10 text-white shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            {group ? (
              <div className="max-h-[380px] overflow-y-auto pr-1">
                <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
                  {group.items.map((url, i) => {
                    const selected = preview === url;
                    return (
                      <button
                        key={url}
                        onClick={() => { setRawFile(null); setPreview(url); }}
                        aria-label={`${group.label} avatar ${i + 1}`}
                        aria-pressed={selected}
                        className={`relative aspect-square rounded-full transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none ${
                          selected
                            ? "ring-2 ring-averna-neon ring-offset-2 ring-offset-background"
                            : "ring-1 ring-white/10 hover:ring-white/30"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full rounded-full object-cover" loading="lazy" />
                        {selected && (
                          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-averna-neon text-black shadow">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
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
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/15 py-8 text-gray-400 transition-colors hover:border-averna-cyan/40 hover:text-white"
                >
                  <Upload className="h-7 w-7" />
                  <span className="text-sm">Choose a photo</span>
                  <span className="text-xs text-gray-500">JPG or PNG — auto-cropped to a square</span>
                </button>

                {rawFile && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-gray-400">Choose size</p>
                    <div className="flex gap-2">
                      {SIZES.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => changeSize(s.key)}
                          className={`flex-1 rounded-lg border py-2 text-sm transition-colors ${
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
