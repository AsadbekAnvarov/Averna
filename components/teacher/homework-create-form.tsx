"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, CalendarClock, Files, Library, Loader2, NotebookPen, Send, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  HomeworkLibraryPicker,
  SelectionPreview,
  isSelectionComplete,
  selectionDifficulty,
  selectionPayload,
  selectionTitle,
  type LibrarySelection,
} from "./homework-library-picker";

/**
 * Set homework: from the test library (a Reading / Listening paper or one
 * passage / part, a Writing task or the full Writing test, a Speaking set) or
 * a classic free-text task — for one, several or all of the teacher's groups.
 */

export interface CreateHomeworkGroup {
  id: string;
  name: string;
  level: string | null;
  students: number;
}

interface Template {
  id: string;
  title: string;
  description: string;
  module: string;
  points: number;
}

type Mode = "library" | "classic";

const MODULES: [string, string][] = [
  ["WRITING", "Writing"],
  ["READING", "Reading"],
  ["LISTENING", "Listening"],
  ["SPEAKING", "Speaking"],
];

const fieldCls = "bg-background/50";
const selectCls =
  "h-10 w-full rounded-md border border-input bg-background/60 px-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon";
const presetCls =
  "inline-flex min-h-[32px] items-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs text-gray-300 transition-colors hover:border-averna-neon/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon";

/** "YYYY-MM-DDTHH:mm" in the browser's time zone (what <input type="datetime-local"> expects). */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d);
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl border border-white/10 p-4 sm:p-6" aria-labelledby={`hw-step-${step}`}>
      <h2 id={`hw-step-${step}`} className="flex items-center gap-2 text-lg font-semibold text-white">
        <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-averna-neon/15 text-xs font-bold text-averna-neon">
          {step}
        </span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-gray-400">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HomeworkCreateForm({
  groups,
  defaultGroupIds,
  defaultMode,
}: {
  groups: CreateHomeworkGroup[];
  defaultGroupIds: string[];
  defaultMode: Mode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("WRITING");
  const [difficulty, setDifficulty] = useState(2);
  const [difficultyEdited, setDifficultyEdited] = useState(false);
  const [points, setPoints] = useState("50");
  const [due, setDue] = useState("");
  const [minDue, setMinDue] = useState<string | undefined>(undefined);
  const [groupIds, setGroupIds] = useState<string[]>(defaultGroupIds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Classic helpers (AI draft + saved templates).
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);

  // Dates depend on the browser's clock and time zone — set after hydration.
  useEffect(() => {
    setDue((d: string) => d || inDays(7));
    setMinDue(toLocalInput(new Date()));
  }, []);

  const complete = isSelectionComplete(selection);
  const suggested = complete && selection ? selectionTitle(selection) : "";

  // The suggested title / difficulty follow the selection until the teacher edits them.
  useEffect(() => {
    if (mode === "library" && !titleEdited) setTitle(suggested);
  }, [suggested, mode, titleEdited]);
  useEffect(() => {
    if (!selection || difficultyEdited) return;
    const d = selectionDifficulty(selection);
    if (d != null) setDifficulty(d);
  }, [selection, difficultyEdited]);

  useEffect(() => {
    if (mode !== "classic" || templatesLoaded) return;
    setTemplatesLoaded(true);
    fetch("/api/teacher/homework/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d?.templates) ? d.templates : []))
      .catch(() => {});
  }, [mode, templatesLoaded]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setError(null);
    if (!titleEdited) setTitle(m === "library" ? suggested : "");
  };

  // Any edit (even clearing the field) stops the suggestion from overwriting it;
  // an empty library title falls back to the suggestion on the server.
  const onTitle = (v: string) => {
    setTitle(v);
    setTitleEdited(v !== suggested);
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTitle(t.title);
    setTitleEdited(true);
    setDescription(t.description);
    if (MODULES.some(([m]) => m === t.module)) setModule(t.module);
    setPoints(String(t.points));
  };

  const saveTemplate = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Add a title and instructions first.");
      return;
    }
    setSavingTpl(true);
    try {
      const res = await fetch("/api/teacher/homework/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, module, points: Number(points) || 50 }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.template) throw new Error();
      setTemplates((prev: Template[]) => [data.template, ...prev]);
      toast.success("Template saved.");
    } catch {
      toast.error("The template couldn't be saved.");
    } finally {
      setSavingTpl(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/teacher/homework/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, level: "Intermediate", topic: aiTopic }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.title) throw new Error(data?.error || "");
      setTitle(data.title);
      setTitleEdited(true);
      setDescription(data.description ?? "");
    } catch (e) {
      toast.error((e instanceof Error && e.message) || "Could not generate homework. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const toggleGroup = (id: string) =>
    setGroupIds((prev: string[]) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  const allSelected = groups.length > 0 && groups.every((g) => groupIds.includes(g.id));
  const chosen = groups.filter((g) => groupIds.includes(g.id));
  const studentsReached = chosen.reduce((s, g) => s + g.students, 0);

  const validate = (): string | null => {
    if (!groups.length) return "You have no groups to set homework for yet.";
    if (mode === "library") {
      if (!selection) return "Choose a test from the library.";
      if (!isSelectionComplete(selection)) return "Choose both a Task 1 and a Task 2 for the Writing test.";
    } else {
      if (!title.trim()) return "Add a title.";
      if (!description.trim()) return "Add instructions for your students.";
    }
    if (!due) return "Set a due date.";
    const t = new Date(due).getTime();
    if (!Number.isFinite(t)) return "Set a valid due date.";
    if (t < Date.now()) return "That due date has already passed — choose a time in the future.";
    const p = Number(points);
    if (!Number.isFinite(p) || p < 10 || p > 200) return "Points must be between 10 and 200.";
    if (!groupIds.length) return "Choose at least one group.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    const shared = {
      title: title.trim(),
      difficulty,
      points: Number(points),
      dueDate: new Date(due).toISOString(),
      groupIds,
    };
    const body =
      mode === "library" && selection
        ? { ...selectionPayload(selection), ...shared, description: note.trim() }
        : { ...shared, description: description.trim(), module };
    try {
      const res = await fetch("/api/teacher/homework/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "The homework couldn't be created. Please try again.");
      const n = typeof data?.groups === "number" ? data.groups : groupIds.length;
      toast.success(n > 1 ? `Homework set for ${n} groups — students have been notified.` : "Homework set — students have been notified.");
      router.push(n === 1 && data?.homeworkId ? `/teacher/homework/${encodeURIComponent(data.homeworkId)}` : "/teacher/homework");
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "The homework couldn't be created. Please try again.";
      setError(msg);
      toast.error(msg);
      setSubmitting(false);
    }
  };

  const modeBtn = (on: boolean) =>
    cn(
      "flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon",
      on ? "bg-averna-primary text-white shadow" : "text-gray-300 hover:bg-white/5 hover:text-white"
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div role="group" aria-label="Kind of homework" className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <button type="button" aria-pressed={mode === "library"} onClick={() => switchMode("library")} className={modeBtn(mode === "library")}>
          <Library className="h-4 w-4" aria-hidden /> From the test library
        </button>
        <button type="button" aria-pressed={mode === "classic"} onClick={() => switchMode("classic")} className={modeBtn(mode === "classic")}>
          <NotebookPen className="h-4 w-4" aria-hidden /> Classic task
        </button>
      </div>

      {mode === "library" ? (
        <Section step={1} title="Choose the test" hint="Search the whole library — exam papers, single passages and parts, Writing prompts and Speaking sets.">
          <HomeworkLibraryPicker value={selection} onChange={setSelection} />
          {complete && selection && (
            <div className="mt-5">
              <SelectionPreview selection={selection} />
            </div>
          )}
        </Section>
      ) : (
        <Section step={1} title="Write the task" hint="Free-text homework: students answer in a text box and you grade it.">
          <div className="mb-4 rounded-xl border border-averna-purple/30 bg-averna-purple/10 p-4">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-averna-purple">
              <Sparkles className="h-4 w-4" aria-hidden /> AI homework generator
            </p>
            <p className="mb-3 text-xs text-gray-400">Pick a module below, optionally add a topic, and let AI draft the task. You can edit it after.</p>
            <div className="flex gap-2">
              <Input
                value={aiTopic}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAiTopic(e.target.value)}
                // Enter drafts with AI — it must not submit the homework form.
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (!generating) handleGenerate();
                }}
                placeholder="Optional topic, e.g. 'the environment'"
                aria-label="Topic for the AI draft"
                className={fieldCls}
              />
              <Button type="button" onClick={handleGenerate} disabled={generating} className="neon-button shrink-0 bg-averna-purple/80 hover:bg-averna-purple">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                <span className="ml-1 hidden sm:inline">Generate</span>
              </Button>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-averna-cyan/30 bg-averna-cyan/10 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-averna-cyan">
              <Files className="h-4 w-4" aria-hidden /> Templates
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => e.target.value && applyTemplate(e.target.value)}
                defaultValue=""
                aria-label="Load a saved template"
                className={cn(selectCls, "flex-1")}
              >
                <option value="" className="bg-averna-dark">
                  {templates.length ? "Load a saved template…" : "No saved templates yet"}
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id} className="bg-averna-dark">
                    {t.module} · {t.title}
                  </option>
                ))}
              </select>
              <Button type="button" onClick={saveTemplate} disabled={savingTpl} variant="outline" className="shrink-0 border-averna-cyan/40 text-averna-cyan">
                {savingTpl ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BookmarkPlus className="h-4 w-4" aria-hidden />}
                <span className="ml-1">Save current as template</span>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hw-module">Module *</Label>
              <select id="hw-module" value={module} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModule(e.target.value)} className={selectCls}>
                {MODULES.map(([v, l]) => (
                  <option key={v} value={v} className="bg-averna-dark">
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-description">Instructions *</Label>
              <Textarea
                id="hw-description"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Detailed instructions for the homework…"
                className="min-h-[200px] bg-background/50"
              />
            </div>
          </div>
        </Section>
      )}

      <Section step={2} title="Details">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label htmlFor="hw-title">{mode === "library" ? "Title" : "Title *"}</Label>
              {mode === "library" && titleEdited && suggested && (
                <button
                  type="button"
                  onClick={() => {
                    setTitle(suggested);
                    setTitleEdited(false);
                  }}
                  className="text-xs font-medium text-averna-neon hover:underline"
                >
                  Use the suggested title
                </button>
              )}
            </div>
            <Input
              id="hw-title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTitle(e.target.value)}
              placeholder={mode === "library" ? suggested || "Filled in from the test you choose" : "e.g. IELTS Writing Task 2: Technology"}
              maxLength={200}
              className={fieldCls}
            />
          </div>

          {mode === "library" && (
            <div className="space-y-2">
              <Label htmlFor="hw-note">Note for students (optional)</Label>
              <Textarea
                id="hw-note"
                value={note}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                placeholder="e.g. Focus on the True / False / Not Given questions — we'll go through them on Friday."
                maxLength={5000}
                className="min-h-[88px] bg-background/50"
              />
              <p className="text-xs text-gray-500">Left empty, students see a short description of the test and how it is marked.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="hw-due" className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-averna-cyan" aria-hidden /> Due *
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="hw-due"
                type="datetime-local"
                value={due}
                min={minDue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDue(e.target.value)}
                className={cn(fieldCls, "sm:max-w-xs")}
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Quick due dates">
                {[
                  [1, "Tomorrow"],
                  [3, "In 3 days"],
                  [7, "In a week"],
                ].map(([n, l]) => (
                  <button key={String(n)} type="button" onClick={() => setDue(inDays(Number(n)))} className={presetCls}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">Late work is still accepted and marked as late.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hw-points">Base points *</Label>
              <Input
                id="hw-points"
                type="number"
                inputMode="numeric"
                min={10}
                max={200}
                value={points}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPoints(e.target.value)}
                className={fieldCls}
              />
              <p className="text-xs text-gray-500">+10 bonus for the 1st submission, +8 for the 2nd, +6 for the 3rd.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hw-difficulty">Difficulty</Label>
              <select
                id="hw-difficulty"
                value={String(difficulty)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setDifficulty(Number(e.target.value));
                  setDifficultyEdited(true);
                }}
                className={selectCls}
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d} className="bg-averna-dark">
                    {"⭐".repeat(d)} ({d}/5)
                  </option>
                ))}
              </select>
              {mode === "library" && selection && (selection.kind === "READING" || selection.kind === "LISTENING") && !difficultyEdited && (
                <p className="text-xs text-gray-500">Suggested from the test’s level ({selection.item.difficulty}).</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section step={3} title="Assign to" hint={groups.length > 1 ? "One homework is created for each group you choose." : undefined}>
        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-400">
            You have no groups yet — an admin needs to assign you a group before you can set homework.
          </p>
        ) : (
          <fieldset>
            <legend className="sr-only">Groups</legend>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => setGroupIds(allSelected ? [] : groups.map((g) => g.id))}
                className="mb-3 text-sm font-medium text-averna-neon hover:underline"
              >
                {allSelected ? "Clear selection" : `Select all ${groups.length} groups`}
              </button>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {groups.map((g) => {
                const on = groupIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={cn(
                      "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-averna-neon",
                      on ? "border-averna-neon/50 bg-averna-neon/[0.07]" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    )}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleGroup(g.id)} className="h-4 w-4 shrink-0 accent-[#00FF94]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{g.name}</span>
                      <span className="block text-xs text-gray-400">
                        {g.students} student{g.students === 1 ? "" : "s"}
                        {g.level ? ` · ${g.level}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </Section>

      <div className="glass-strong sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm" aria-live="polite">
          {error ? (
            <p role="alert" className="text-red-300">
              {error}
            </p>
          ) : chosen.length ? (
            <p className="flex items-center gap-2 text-gray-300">
              <Users className="h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
              {chosen.length === 1 ? chosen[0].name : `${chosen.length} groups`} · {studentsReached} student{studentsReached === 1 ? "" : "s"} will be notified
            </p>
          ) : (
            <p className="text-gray-400">Choose at least one group.</p>
          )}
        </div>
        <Button type="submit" disabled={submitting || groups.length === 0} className="neon-button min-h-[44px] shrink-0 bg-averna-primary hover:bg-averna-light">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Setting homework…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" aria-hidden />
              {chosen.length > 1 ? `Set for ${chosen.length} groups` : "Set homework"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
