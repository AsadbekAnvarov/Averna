"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import {
  Eye, EyeOff, Type, Snowflake, LogOut, Volume2, Music, Moon, Sun, Palette, Sparkles, Play, Headphones,
  Glasses, AlignJustify, Contrast, Ruler, Languages, BookOpenText,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { useSound } from "@/components/audio/sound-provider";
import { UI_PACKS, SCENES } from "@/components/audio/sound-engine";
import { useComfortPrefs } from "@/components/comfort/use-comfort-prefs";
import { primeStudentLevel } from "@/components/l1/use-l1";
import { SettingsGroup } from "@/components/settings/settings-group";
import { DEFAULT_PREFS, type L1Choice } from "@/lib/comfort/prefs";
import { L1_NAME, l1Hint, type L1Lang } from "@/lib/l1/hints";
import { levelWantsHints, suggestL1 } from "@/lib/l1/level";
import { displaySummary, effectsSummary, hintsSummary, readingSummary, soundSummary } from "@/lib/settings/summary";
import { cn } from "@/lib/utils";
import { wipeOfflineData } from "@/lib/offline/store";

/** What the student sees when hints are on: one real instruction and its hint. */
const SAMPLE_INSTRUCTION = "Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.";
const LANGUAGE_NAME: Record<L1Lang, string> = { uz: "Uzbek", ru: "Russian" };

/**
 * Device preferences in disclosure groups (components/settings/settings-group.tsx),
 * laid out in two columns from lg up (DOM order = reading order per column):
 *   left:  Display (theme, text size) → Reading comfort (font, spacing,
 *          contrast, ruler) → Native-language hints (students)
 *   right: `account` (the page's Account and Telegram groups) → Comfort &
 *          effects → Sound → Sign out
 * On phones it is one column in the same order, only Display open.
 * Text size and reading comfort go through lib/comfort/prefs.ts (the same keys
 * and <html> classes as the dashboard's quick "Customize" panel and the
 * pre-paint COMFORT_SCRIPT), so changes stay in sync everywhere:
 *   - averna_text_scale / _font / _line_spacing / _contrast / _ruler / _l1 / _l1_when
 *   - averna_focus_mode  -> body.focus-mode
 *   - averna_seasonal    -> seasonal decorations ("averna-seasonal" event)
 *   - averna_ambiance    -> time-of-day ambiance ("averna-ambiance" event)
 *   - averna_sound_*     -> components/audio/sound-provider.tsx
 */
export function SettingsPanel({
  student,
  account,
}: {
  /** Students only: their level and profile language (native-language hints). */
  student?: { level: string | null; nativeLanguage: string | null } | null;
  /** Groups rendered by the page at the top of the second column (Account, Telegram). */
  account?: ReactNode;
} = {}) {
  const { mode, setMode } = useTheme();
  const { prefs, setPrefs, preview } = useSound();
  const { prefs: comfortPrefs, update: updateComfort } = useComfortPrefs();
  const comfort = comfortPrefs ?? DEFAULT_PREFS;
  const [focus, setFocus] = useState(false);
  const [seasonal, setSeasonal] = useState(true);
  const [ambiance, setAmbiance] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setFocus(localStorage.getItem("averna_focus_mode") === "1");
    setSeasonal(localStorage.getItem("averna_seasonal") !== "0");
    setAmbiance(localStorage.getItem("averna_ambiance") !== "0");
  }, []);

  // The server already knows the student's level: hints elsewhere need not ask again.
  const studentLevel = student?.level ?? null;
  useEffect(() => {
    if (student) primeStudentLevel(studentLevel);
  }, [student, studentLevel]);

  const applyFocus = (v: boolean) => {
    setFocus(v);
    document.body.classList.toggle("focus-mode", v);
    localStorage.setItem("averna_focus_mode", v ? "1" : "0");
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
    // grid-cols-1 (minmax(0, 1fr)), not an implicit auto track: the truncated header lines must not
    // widen the column past the screen.
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start lg:gap-5">
      {/* ================================================== first column */}
      <div className="min-w-0 space-y-3 lg:space-y-4">
        {/* ------------------------------------------------------ Display */}
        <SettingsGroup
          id="display"
          icon={<Palette />}
          title="Display"
          subtitle="How Averna looks on this device"
          summary={displaySummary(mode, comfort.textScale)}
          accent="text-averna-cyan"
          phoneOpen
        >
          <Row icon={mode === "dark" ? Moon : Sun} iconClass={mode === "dark" ? "text-averna-purple" : "text-amber-400"} title="Theme">
            <Segmented
              label="Theme"
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
              label="Text size"
              value={comfort.textScale}
              onChange={(textScale) => updateComfort({ textScale })}
              options={[
                { value: "sm", label: "Small" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Large" },
              ]}
            />
          </Row>
        </SettingsGroup>

        {/* ---------------------------------------------- Reading comfort */}
        <SettingsGroup
          id="reading-comfort"
          icon={<Glasses />}
          title="Reading comfort"
          subtitle="Easier reading on every page"
          summary={readingSummary(comfort)}
          accent="text-averna-cyan"
        >
          <ToggleRow
            icon={BookOpenText}
            title="Readable font"
            desc="Clearer letters · good for dyslexia"
            on={comfort.font === "readable"}
            onChange={(v) => updateComfort({ font: v ? "readable" : "default" })}
            tone="bg-averna-cyan/70"
            iconOn="text-averna-cyan"
          />
          <Row icon={AlignJustify} iconClass="text-averna-cyan" title="Line spacing">
            <Segmented
              label="Line spacing"
              value={comfort.lineSpacing}
              onChange={(lineSpacing) => updateComfort({ lineSpacing })}
              options={[
                { value: "normal", label: "Normal" },
                { value: "relaxed", label: "Relaxed" },
                { value: "loose", label: "Loose" },
              ]}
            />
          </Row>
          <ToggleRow
            icon={Contrast}
            title="High contrast"
            desc="Brighter text and stronger borders"
            on={comfort.contrast === "high"}
            onChange={(v) => updateComfort({ contrast: v ? "high" : "normal" })}
            tone="bg-averna-neon/70"
            iconOn="text-averna-neon"
          />
          <ToggleRow
            icon={Ruler}
            title="Reading ruler"
            desc="Highlights the line you read · Alt+R"
            on={comfort.ruler === "on"}
            onChange={(v) => updateComfort({ ruler: v ? "on" : "off" })}
            tone="bg-averna-purple/70"
            iconOn="text-averna-purple"
          />
          {/* A two-line sample in the chosen font, spacing and contrast. */}
          <div className="p-3 sm:px-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="line-clamp-2 text-sm text-gray-100">
                <span className="font-semibold text-gray-400">Preview · </span>
                The museum opened in 1998 and now welcomes over two million visitors a year. Most of them come to see its
                collection of early aircraft, the largest in the region.
              </p>
            </div>
          </div>
        </SettingsGroup>

        {/* --------------------------------------- Native-language hints */}
        {student && <L1HintsGroup level={student.level} nativeLanguage={student.nativeLanguage} l1={comfort.l1} l1When={comfort.l1When} onChange={updateComfort} />}
      </div>

      {/* ================================================= second column */}
      <div className="min-w-0 space-y-3 lg:space-y-4">
        {account}

        {/* ------------------------------------------------------ Comfort */}
        <SettingsGroup
          id="effects"
          icon={<Sparkles />}
          title="Comfort & effects"
          subtitle="As calm or as lively as you like"
          summary={effectsSummary({ focus, seasonal, ambiance })}
          accent="text-averna-neon"
        >
          <ToggleRow
            icon={focus ? EyeOff : Eye}
            title="Focus mode"
            desc="Hide the study pet, quests and extras"
            on={focus}
            onChange={applyFocus}
            tone="bg-averna-neon/70"
            iconOn="text-averna-neon"
          />
          <ToggleRow
            icon={Snowflake}
            title="Seasonal effects"
            desc="Falling decorations on the dashboard"
            on={seasonal}
            onChange={applySeasonal}
            tone="bg-averna-cyan/70"
            iconOn="text-averna-cyan"
          />
          <ToggleRow
            icon={Moon}
            title="Time-of-day ambiance"
            desc="Warm mornings, starry nights"
            on={ambiance}
            onChange={applyAmbiance}
            tone="bg-averna-purple/70"
            iconOn="text-averna-purple"
          />
        </SettingsGroup>

        {/* -------------------------------------------------------- Sound */}
        <SettingsGroup
          id="sound"
          icon={<Headphones />}
          title="Sound"
          subtitle="Off by default · generated live, nothing to download"
          summary={soundSummary({
            ui: prefs.ui,
            uiPackLabel: UI_PACKS.find((p) => p.key === prefs.uiPack)?.label,
            ambient: prefs.ambient,
            sceneLabel: SCENES.find((s) => s.key === prefs.scene)?.label,
          })}
          accent="text-averna-pink"
        >
          {/* Interface sounds */}
          <div>
            <ToggleRow
              icon={Volume2}
              title="Interface sounds"
              desc="Soft taps and chimes on buttons"
              on={prefs.ui}
              onChange={toggleUiSounds}
              tone="bg-averna-pink/70"
              iconOn="text-averna-pink"
            />
            {prefs.ui && (
              <div className="space-y-3 px-3 pb-3 animate-fade-in sm:px-4">
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
                        "rounded-xl border px-2 py-2 text-center transition-colors",
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
              desc="Calm background sound for study"
              on={prefs.ambient}
              onChange={(v) => setPrefs({ ambient: v })}
              tone="bg-averna-purple/70"
              iconOn="text-averna-purple"
            />
            {prefs.ambient && (
              <div className="space-y-3 px-3 pb-3 animate-fade-in sm:px-4">
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  {SCENES.map((s) => {
                    const active = prefs.scene === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPrefs({ scene: s.key })}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
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
        </SettingsGroup>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => {
            setSigningOut(true);
            // Offline packs and waiting grades leave the device with the account (idea 7).
            void wipeOfflineData().finally(() => signOut({ callbackUrl: "/" }));
          }}
          disabled={signingOut}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 p-2.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ building blocks */

/**
 * A labelled control: label and control share one line when both fit (desktop,
 * Theme and Text size on most phones) and wrap to two lines when they don't.
 */
function Row({ icon: Icon, iconClass, title, children }: { icon: LucideIcon; iconClass: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 sm:px-4">
      <span className="flex shrink-0 items-center gap-3 text-sm font-medium text-white">
        <Icon className={cn("h-5 w-5 shrink-0", iconClass)} aria-hidden="true" /> {title}
      </span>
      <div className="min-w-[13.5rem] flex-1 sm:max-w-72">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; lang?: string }[]; label?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            // 44 px tall on phones; the label may wrap onto two lines.
            "min-h-11 rounded-lg px-1.5 py-1.5 text-sm font-medium leading-tight transition-colors sm:min-h-9",
            value === o.value ? "bg-white/10 text-white shadow" : "text-gray-400 hover:text-white"
          )}
        >
          <span lang={o.lang}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Native-language hints (students): a short Uzbek or Russian line under the
 * exam's standard instructions, question types and task rubrics, plus "Explain
 * in …" on a result's wrong answers. Off by default; the profile's language
 * is only a suggestion.
 */
function L1HintsGroup({
  level, nativeLanguage, l1, l1When, onChange,
}: {
  level: string | null;
  nativeLanguage: string | null;
  l1: L1Choice;
  l1When: "level" | "always";
  onChange: (patch: { l1?: L1Choice; l1When?: "level" | "always" }) => void;
}) {
  const suggested = suggestL1(nativeLanguage);
  const lang = l1 === "off" ? null : l1;
  const shownAtLevel = levelWantsHints(level);
  const levelText = level?.trim() ? level.trim() : null;
  const status = !lang
    ? null
    : l1When === "always"
      ? "Hints show on every exam screen and result."
      : shownAtLevel
        ? levelText
          ? `Your level is ${levelText}, so hints show.`
          : "Your level isn't set yet, so hints show."
        : `Your level is ${levelText}, so hints are hidden. Choose Always to keep them.`;

  return (
    <SettingsGroup
      id="hints"
      icon={<Languages />}
      title="Native-language hints"
      subtitle="Uzbek or Russian lines under exam instructions"
      summary={hintsSummary(l1, l1When)}
      accent="text-averna-purple"
    >
      <Row icon={Languages} iconClass="text-averna-purple" title="Hint language">
        <Segmented
          label="Hint language"
          value={l1}
          onChange={(v) => onChange({ l1: v })}
          options={[
            { value: "off", label: "Off" },
            { value: "uz", label: L1_NAME.uz, lang: "uz" },
            { value: "ru", label: L1_NAME.ru, lang: "ru" },
          ]}
        />
      </Row>
      {!lang && suggested && (
        <p className="px-3 py-2.5 text-sm text-gray-300 sm:px-4">
          Your profile says {LANGUAGE_NAME[suggested]} — choose <span lang={suggested} className="font-semibold text-white">{L1_NAME[suggested]}</span> to turn hints on.
        </p>
      )}
      {lang && (
        <>
          <Row icon={Eye} iconClass="text-averna-purple" title="Show hints">
            <Segmented
              label="Show hints"
              value={l1When}
              onChange={(v) => onChange({ l1When: v })}
              options={[
                { value: "level", label: "At my level (A2–B1)" },
                { value: "always", label: "Always" },
              ]}
            />
          </Row>
          <div className="space-y-2.5 p-3 sm:px-4">
            <p role="status" className="text-sm text-gray-300">{status}</p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-sm font-semibold text-gray-100">{SAMPLE_INSTRUCTION}</p>
              <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug text-gray-400 sm:text-sm">
                <span aria-hidden="true" className="mt-[0.1em] shrink-0 rounded border border-white/15 px-1 text-[11px] font-semibold leading-[1.45]">
                  {lang.toUpperCase()}
                </span>
                <span lang={lang}>{l1Hint(SAMPLE_INSTRUCTION, lang)}</span>
              </p>
            </div>
            <p className="text-xs text-gray-400">
              The exam itself stays in English. Hints cover question instructions, question types and the Writing and
              Speaking task wording. On a result, wrong answers get an “<span lang={lang}>{lang === "uz" ? "Explain in Oʻzbekcha" : "Объяснить по-русски"}</span>” button (AI,
              up to 40 a day). Text without a checked translation gets no hint.
            </p>
          </div>
        </>
      )}
    </SettingsGroup>
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
      className="flex min-h-11 w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-white/[0.03] sm:px-4"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={cn("h-5 w-5 shrink-0", on ? iconOn : "text-gray-400")} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-white">{title}</span>
          <span className="block text-xs text-gray-400">{desc}</span>
        </span>
      </span>
      <span aria-hidden="true" className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? tone : "bg-white/15")}>
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 text-gray-300 hover:border-white/20 hover:text-white sm:h-8 sm:w-8"
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
