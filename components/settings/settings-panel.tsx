"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import {
  Eye, EyeOff, Type, Snowflake, LogOut, Volume2, Music, Moon, Sun, Palette, Sparkles, Play, Headphones,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { useSound } from "@/components/audio/sound-provider";
import { UI_PACKS, SCENES } from "@/components/audio/sound-engine";
import { cn } from "@/lib/utils";

type FontScale = "sm" | "md" | "lg";

/**
 * Device preferences, grouped the way people look for them:
 *   Display (theme, text size) → Comfort (focus mode, effects) → Sound.
 * Uses the SAME localStorage keys and root classes as the dashboard's quick
 * "Customize" panel, so changes stay in sync everywhere:
 *   - averna_focus_mode  -> body.focus-mode
 *   - averna_text_scale  -> html.text-scale-sm / .text-scale-lg
 *   - averna_seasonal    -> seasonal decorations ("averna-seasonal" event)
 *   - averna_ambiance    -> time-of-day ambiance ("averna-ambiance" event)
 *   - averna_sound_*     -> components/audio/sound-provider.tsx
 */
export function SettingsPanel() {
  const { mode, setMode } = useTheme();
  const { prefs, setPrefs, preview } = useSound();
  const [focus, setFocus] = useState(false);
  const [scale, setScale] = useState<FontScale>("md");
  const [seasonal, setSeasonal] = useState(true);
  const [ambiance, setAmbiance] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setFocus(localStorage.getItem("averna_focus_mode") === "1");
    setScale((localStorage.getItem("averna_text_scale") as FontScale) || "md");
    setSeasonal(localStorage.getItem("averna_seasonal") !== "0");
    setAmbiance(localStorage.getItem("averna_ambiance") !== "0");
  }, []);

  const applyFocus = (v: boolean) => {
    setFocus(v);
    document.body.classList.toggle("focus-mode", v);
    localStorage.setItem("averna_focus_mode", v ? "1" : "0");
  };

  const applyScale = (v: FontScale) => {
    setScale(v);
    const el = document.documentElement;
    el.classList.remove("text-scale-sm", "text-scale-lg");
    if (v === "sm") el.classList.add("text-scale-sm");
    if (v === "lg") el.classList.add("text-scale-lg");
    localStorage.setItem("averna_text_scale", v);
  };

  const applySeasonal = (v: boolean) => {
    setSeasonal(v);
    localStorage.setItem("averna_seasonal", v ? "1" : "0");
    window.dispatchEvent(new Event("averna-seasonal"));
  };

  const applyAmbiance = (v: boolean) => {
    setAmbiance(v);
    localStorage.setItem("averna_ambiance", v ? "1" : "0");
    window.dispatchEvent(new Event("averna-ambiance"));
  };

  const toggleUiSounds = () => {
    const on = !prefs.ui;
    setPrefs({ ui: on });
    if (on) preview("toggle");
  };

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------- Display */}
      <Group icon={Palette} title="Display" subtitle="How Averna looks on this device" accent="text-averna-cyan">
        <Row icon={mode === "dark" ? Moon : Sun} iconClass={mode === "dark" ? "text-averna-purple" : "text-amber-400"} title="Theme">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
          />
        </Row>
        <Row icon={Type} iconClass="text-averna-cyan" title="Text size">
          <Segmented
            value={scale}
            onChange={applyScale}
            options={[
              { value: "sm", label: "Small" },
              { value: "md", label: "Medium" },
              { value: "lg", label: "Large" },
            ]}
          />
        </Row>
      </Group>

      {/* ---------------------------------------------------------- Comfort */}
      <Group icon={Sparkles} title="Comfort & effects" subtitle="Keep the screen as calm or as lively as you like" accent="text-averna-neon">
        <ToggleRow
          icon={focus ? EyeOff : Eye}
          title="Focus mode"
          desc="Hide the study pet, quests and other extras for exam-cram days"
          on={focus}
          onChange={applyFocus}
          tone="bg-averna-neon/70"
          iconOn="text-averna-neon"
        />
        <ToggleRow
          icon={Snowflake}
          title="Seasonal effects"
          desc="Gentle falling decorations on the dashboard"
          on={seasonal}
          onChange={applySeasonal}
          tone="bg-averna-cyan/70"
          iconOn="text-averna-cyan"
        />
        <ToggleRow
          icon={Moon}
          title="Time-of-day ambiance"
          desc="Warm mornings, starry nights on the dashboard"
          on={ambiance}
          onChange={applyAmbiance}
          tone="bg-averna-purple/70"
          iconOn="text-averna-purple"
        />
      </Group>

      {/* ------------------------------------------------------------ Sound */}
      <Group icon={Headphones} title="Sound" subtitle="Off by default · everything is generated live, nothing to download" accent="text-averna-pink">
        {/* Interface sounds */}
        <div>
          <ToggleRow
            icon={Volume2}
            title="Interface sounds"
            desc="Soft taps on buttons and chimes for saves, errors and alerts"
            on={prefs.ui}
            onChange={toggleUiSounds}
            tone="bg-averna-pink/70"
            iconOn="text-averna-pink"
          />
          {prefs.ui && (
            <div className="space-y-4 px-4 pb-4 pt-1 animate-fade-in">
              <div className="grid grid-cols-3 gap-2">
                {UI_PACKS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    data-no-sound
                    aria-pressed={prefs.uiPack === p.key}
                    onClick={() => {
                      setPrefs({ uiPack: p.key });
                      preview("success", p.key);
                    }}
                    className={cn(
                      "rounded-xl border px-2 py-2.5 text-center transition-colors",
                      prefs.uiPack === p.key
                        ? "border-averna-pink/50 bg-averna-pink/10 text-white"
                        : "border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
                    )}
                  >
                    <span className="block text-sm font-semibold">{p.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-gray-400">{p.desc}</span>
                  </button>
                ))}
              </div>
              <VolumeSlider
                label="Interface volume"
                value={prefs.uiVolume}
                onChange={(v) => setPrefs({ uiVolume: v })}
                onCommit={() => preview("tap")}
                onTest={() => preview("notify")}
              />
            </div>
          )}
        </div>

        {/* Ambient atmosphere */}
        <div>
          <ToggleRow
            icon={Music}
            title="Ambient atmosphere"
            desc="A calm background soundscape for focused study"
            on={prefs.ambient}
            onChange={(v) => setPrefs({ ambient: v })}
            tone="bg-averna-purple/70"
            iconOn="text-averna-purple"
          />
          {prefs.ambient && (
            <div className="space-y-4 px-4 pb-4 pt-1 animate-fade-in">
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
                {SCENES.map((s) => {
                  const active = prefs.scene === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPrefs({ scene: s.key })}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-averna-purple/50 bg-averna-purple/10"
                          : "border-white/10 hover:border-white/20"
                      )}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-lg" aria-hidden>
                        {s.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                          {s.label}
                          {active && <EqualizerBars />}
                        </span>
                        <span className="block truncate text-[11px] text-gray-400">{s.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <VolumeSlider
                label="Ambient volume"
                value={prefs.ambientVolume}
                onChange={(v) => setPrefs({ ambientVolume: v })}
              />
            </div>
          )}
        </div>
      </Group>

      {/* Sign out */}
      <button
        type="button"
        onClick={() => {
          setSigningOut(true);
          signOut({ callbackUrl: "/" });
        }}
        disabled={signingOut}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ building blocks */

function Group({
  icon: Icon, title, subtitle, accent, children,
}: { icon: LucideIcon; title: string; subtitle?: string; accent: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/15 to-white/[0.03]", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      <div className="glass overflow-hidden rounded-2xl border border-white/5 divide-y divide-white/5">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, iconClass, title, children }: { icon: LucideIcon; iconClass: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-3 text-sm font-medium text-white">
        <Icon className={cn("h-5 w-5 shrink-0", iconClass)} /> {title}
      </span>
      <div className="sm:w-72">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg py-2 text-sm font-medium transition-colors",
            value === o.value ? "bg-white/10 text-white shadow" : "text-gray-400 hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  icon: Icon, title, desc, on, onChange, tone, iconOn,
}: {
  icon: LucideIcon; title: string; desc: string; on: boolean; onChange: (v: boolean) => void;
  tone: string; iconOn: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.03]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={cn("h-5 w-5 shrink-0", on ? iconOn : "text-gray-400")} />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-white">{title}</span>
          <span className="block text-xs text-gray-400">{desc}</span>
        </span>
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? tone : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function VolumeSlider({
  label, value, onChange, onCommit, onTest,
}: { label: string; value: number; onChange: (v: number) => void; onCommit?: () => void; onTest?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Volume2 className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={label}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="averna-range min-w-0 flex-1"
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-400">{Math.round(value * 100)}%</span>
      {onTest && (
        <button
          type="button"
          data-no-sound
          onClick={onTest}
          aria-label="Play a test sound"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:border-white/20 hover:text-white"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Tiny animated "now playing" bars for the active soundscape. */
function EqualizerBars() {
  return (
    <span className="inline-flex h-3 items-end gap-[2px]" aria-label="Playing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm bg-averna-purple animate-pulse"
          style={{ height: `${[60, 100, 40][i]}%`, animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}
