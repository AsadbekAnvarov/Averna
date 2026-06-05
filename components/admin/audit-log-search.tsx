"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

export interface AuditRow {
  id: string;
  actorName: string;
  role: string;
  action: string;
  detail: string | null;
  dateStr: string;
}

export function AuditLogSearch({ logs }: { logs: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");

  const roles = useMemo(() => ["ALL", ...Array.from(new Set(logs.map((l) => l.role)))], [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (role !== "ALL" && l.role !== role) return false;
      if (!q) return true;
      return (
        l.actorName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.detail ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs, query, role]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by person, action or detail…"
            className="w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
        >
          {roles.map((r) => (
            <option key={r} value={r} className="bg-averna-dark">
              {r === "ALL" ? "All roles" : r}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {filtered.length} of {logs.length} entries
      </p>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-6 text-center">No matching audit entries.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/30 shrink-0 mt-0.5">
                {l.role}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm">
                  <span className="font-medium">{l.actorName}</span> — {l.action}
                </p>
                {l.detail && <p className="text-xs text-gray-400 break-words">{l.detail}</p>}
                <p className="text-[11px] text-gray-500 mt-0.5">{l.dateStr}</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-averna-cyan/40 shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
