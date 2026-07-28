"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Trash2, Snowflake, Search, Mic, X } from "lucide-react";

export interface RosterStudent {
  id: string;
  name: string | null;
  email: string;
  level: string | null;
  groupId: string | null;
  blacklisted: boolean;
}

export interface RosterGroup {
  id: string;
  name: string;
  teacherName: string | null;
}

type Action = (formData: FormData) => void | Promise<void>;

type SortKey = "name" | "level" | "group" | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Ism (A–Z)" },
  { value: "level", label: "Daraja" },
  { value: "group", label: "Guruh" },
  { value: "status", label: "Holat" },
];

const COLLATOR = new Intl.Collator("uz");

/** Order the roster by the chosen key, always tie-breaking on name so the list
 *  never jitters between equal rows. Unassigned/blank values sort last. Pure. */
function sortStudents(
  list: RosterStudent[],
  key: SortKey,
  groupNameById: Record<string, string>
): RosterStudent[] {
  const LAST = "\uffff"; // sorts after any real text, so "no value" lands at the end
  const byName = (a: RosterStudent, b: RosterStudent) =>
    COLLATOR.compare((a.name ?? "").trim() || a.email, (b.name ?? "").trim() || b.email);
  return [...list].sort((a, b) => {
    if (key === "level") return COLLATOR.compare(a.level || LAST, b.level || LAST) || byName(a, b);
    if (key === "group") {
      const ga = a.groupId ? groupNameById[a.groupId] ?? LAST : LAST;
      const gb = b.groupId ? groupNameById[b.groupId] ?? LAST : LAST;
      return COLLATOR.compare(ga, gb) || byName(a, b);
    }
    if (key === "status") return Number(a.blacklisted) - Number(b.blacklisted) || byName(a, b);
    return byName(a, b);
  });
}

/**
 * Admin student roster with instant client-side search (by name or email) and
 * optional voice search (Web Speech API). The rows keep using the server
 * actions passed in as props (enroll / freeze / delete), so behaviour is
 * unchanged — this just makes finding one student among many fast. The search
 * bar only appears once the list is large enough to need it. Uzbek UI.
 */
export function StudentRoster({
  students,
  groups,
  levels,
  enrollAction,
  deleteAction,
  freezeAction,
  emptyText,
}: {
  students: RosterStudent[];
  groups: RosterGroup[];
  levels: string[];
  enrollAction: Action;
  deleteAction: Action;
  freezeAction: Action;
  emptyText: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    setVoiceSupported(!!SR);
  }, []);

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "uz-UZ";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? "";
      if (text) setQ(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stopVoice = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  const query = q.trim().toLowerCase();
  const groupNameById = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const matched = query
    ? students.filter(
        (s) => (s.name ?? "").toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
      )
    : students;
  const filtered = sortStudents(matched, sort, groupNameById);

  const showSearch = students.length > 6;

  return (
    <div className="space-y-3">
      {showSearch && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ism yoki email boʻyicha qidirish…"
              className="w-full rounded-lg border border-white/10 bg-background/60 pl-9 pr-8 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                title="Tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {voiceSupported && (
            <button
              type="button"
              onClick={listening ? stopVoice : startVoice}
              title={listening ? "Tinglashni toʻxtatish" : "Ovoz bilan qidirish"}
              className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center transition-colors ${
                listening
                  ? "border-red-400/50 bg-red-400/15 text-red-300 animate-pulse"
                  : "border-white/10 bg-white/5 text-gray-400 hover:text-averna-cyan hover:border-averna-cyan/40"
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {showSearch && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-gray-500 shrink-0">Saralash:</span>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            {SORT_OPTIONS.map((o) => {
              const active = sort === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSort(o.value)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    active ? "bg-averna-cyan/20 text-averna-cyan" : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showSearch && query && <p className="text-[11px] text-gray-500">{filtered.length} ta natija</p>}

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">{query ? "Hech narsa topilmadi." : emptyText}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <StudentRow
              key={s.id}
              s={s}
              groups={groups}
              levels={levels}
              enrollAction={enrollAction}
              deleteAction={deleteAction}
              freezeAction={freezeAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentRow({
  s,
  groups,
  levels,
  enrollAction,
  deleteAction,
  freezeAction,
}: {
  s: RosterStudent;
  groups: RosterGroup[];
  levels: string[];
  enrollAction: Action;
  deleteAction: Action;
  freezeAction: Action;
}) {
  return (
    <form
      action={enrollAction}
      className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 transition-colors hover:border-averna-cyan/30"
    >
      <input type="hidden" name="studentId" value={s.id} />
      <div className="md:w-56 min-w-0">
        <p className="text-white font-medium truncate flex items-center gap-1.5">
          <span className="truncate">{s.name ?? "Nomsiz"}</span>
          {s.blacklisted && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan">
              Muzlatilgan
            </span>
          )}
        </p>
        <p className="text-xs text-gray-400 truncate">{s.email}</p>
      </div>
      <select
        name="level"
        defaultValue={s.level ?? ""}
        className="rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple md:flex-1"
      >
        <option value="" className="bg-averna-dark">— Daraja —</option>
        {levels.map((l) => (
          <option key={l} value={l} className="bg-averna-dark">{l}</option>
        ))}
      </select>
      <select
        name="groupId"
        defaultValue={s.groupId ?? ""}
        className="rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan md:flex-1"
      >
        <option value="" className="bg-averna-dark">— Biriktirilmagan —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id} className="bg-averna-dark">
            {g.name}{g.teacherName ? ` · ${g.teacherName}` : ""}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
        Saqlash
      </Button>
      <button
        type="submit"
        formAction={freezeAction}
        title={s.blacklisted ? "Muzlashdan chiqarish" : "Muzlatish"}
        className={`h-9 w-9 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
          s.blacklisted
            ? "border-averna-cyan/40 bg-averna-cyan/15 text-averna-cyan hover:bg-averna-cyan/25"
            : "border-white/10 bg-white/5 text-gray-400 hover:text-averna-cyan hover:border-averna-cyan/40"
        }`}
      >
        <Snowflake className="h-4 w-4" />
      </button>
      <ConfirmButton
        formAction={deleteAction}
        message={`${s.name ?? "Ushbu oʻquvchi"}ni va uning barcha maʼlumotlarini (topshiriqlar, baholar, ballar, toʻlovlar) butunlay oʻchirasizmi? Bu uning hisobini ham oʻchiradi va qaytarib boʻlmaydi.`}
        title="Oʻquvchini oʻchirish"
        className="h-9 w-9 shrink-0 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
      >
        <Trash2 className="h-4 w-4" />
      </ConfirmButton>
    </form>
  );
}
