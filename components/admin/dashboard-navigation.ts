/** Primary admin tasks. Extra tools remain reachable without another duplicate tab. */
export const ADMIN_DASHBOARD_TABS = [
  { key: "overview", label: "Umumiy", icon: "overview", active: "bg-averna-neon/15 text-averna-neon ring-1 ring-averna-neon/40" },
  { key: "people", label: "Oʻquvchilar va qabul", icon: "people", active: "bg-averna-cyan/15 text-averna-cyan ring-1 ring-averna-cyan/40" },
  { key: "finance", label: "Moliya", icon: "finance", active: "bg-averna-purple/15 text-purple-400 ring-1 ring-averna-purple/40" },
  { key: "insights", label: "Tahlil va vositalar", icon: "analytics", active: "bg-averna-purple/15 text-purple-400 ring-1 ring-averna-purple/40" },
];
export const ADMIN_TAB_ALIASES: Record<string,string> = { manage: "insights" };
