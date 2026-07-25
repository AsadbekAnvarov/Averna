"use client";

import { useState } from "react";
import { Search } from "lucide-react";

/**
 * A student selector with a type-to-filter search box, for admin forms where
 * the full student list would be an unwieldy dropdown (e.g. recording a cash
 * payment). The narrowed options stay in a native <select name="studentId"> so
 * the surrounding server-action form submits exactly as before. Uzbek UI.
 */
export function StudentPicker({
  students,
}: {
  students: { id: string; name: string | null; group: string | null }[];
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query
    ? students.filter((s) => (s.name ?? "").toLowerCase().includes(query))
    : students;

  return (
    <div>
      <label className="text-xs text-gray-400">Oʻquvchi</label>
      <div className="relative mt-1 mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ism boʻyicha qidirish…"
          className="w-full rounded-md border border-white/10 bg-background/60 pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-neon"
        />
      </div>
      <select
        name="studentId"
        required
        defaultValue=""
        className="w-full rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-neon"
      >
        <option value="" disabled className="bg-averna-dark">— Oʻquvchini tanlang —</option>
        {filtered.map((s) => (
          <option key={s.id} value={s.id} className="bg-averna-dark">
            {s.name ?? "Nomsiz"}{s.group ? ` · ${s.group}` : ""}
          </option>
        ))}
      </select>
      {query && <p className="text-[11px] text-gray-500 mt-1">{filtered.length} ta natija</p>}
    </div>
  );
}
