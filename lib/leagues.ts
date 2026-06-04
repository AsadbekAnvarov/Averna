// League / season system based on points earned during the current week.

export interface League {
  name: string;
  emoji: string;
  color: string;
  min: number; // weekly points threshold
}

// Ordered from highest to lowest for easy lookup
export const LEAGUES: League[] = [
  { name: "Diamond", emoji: "💎", color: "#7DF9FF", min: 500 },
  { name: "Platinum", emoji: "🏆", color: "#E5E4E2", min: 300 },
  { name: "Gold", emoji: "🥇", color: "#FFD166", min: 180 },
  { name: "Silver", emoji: "🥈", color: "#C0C0C0", min: 90 },
  { name: "Bronze", emoji: "🥉", color: "#CD7F32", min: 30 },
  { name: "Rookie", emoji: "🌱", color: "#00FF94", min: 0 },
];

export function leagueForWeeklyPoints(points: number): League {
  return LEAGUES.find((l) => points >= l.min) ?? LEAGUES[LEAGUES.length - 1];
}

/** Returns the next league up and points needed, or null if already top. */
export function nextLeague(points: number): { league: League; needed: number } | null {
  const current = leagueForWeeklyPoints(points);
  const idx = LEAGUES.findIndex((l) => l.name === current.name);
  if (idx <= 0) return null; // already Diamond
  const up = LEAGUES[idx - 1];
  return { league: up, needed: Math.max(0, up.min - points) };
}

/** Start of the current week (Monday 00:00). */
export function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** ISO-ish season label, e.g. "Season • week of 2 Jun". */
export function seasonLabel(d = new Date()): string {
  const start = startOfWeek(d);
  return `Week of ${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}
