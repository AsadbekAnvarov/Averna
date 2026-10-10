import {
  Zap, Mic, Clapperboard, Lightbulb, BookMarked, ScanLine, Headphones, Timer, Swords, Skull, Ghost, Gauge, Compass,
  type LucideIcon,
} from "lucide-react";

export type StudioGroup = "practice" | "games";

export interface StudioTool {
  slug: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** Icon colour (text-*) and its tinted badge background (bg-*). */
  color: string;
  bg: string;
  group: StudioGroup;
}

/**
 * The Practice Studio: every self-contained practice tool and word game, each
 * on its own page (/studio/<slug>) instead of stacked on the dashboard.
 * Add a tool here + a tiny app/studio/<slug>/page.tsx and it shows up in every
 * shelf automatically.
 */
export const STUDIO_TOOLS: StudioTool[] = [
  { slug: "adventures", title: "Adventures", blurb: "Stories, mysteries, debates and your own creations", icon: Compass, color: "text-averna-cyan", bg: "bg-averna-cyan/15", group: "practice" },
  { slug: "warm-up", title: "60-Second Warm-Up", blurb: "Five quick questions to get your brain going", icon: Zap, color: "text-averna-neon", bg: "bg-averna-neon/15", group: "practice" },
  { slug: "voice-journal", title: "Voice Journal", blurb: "A 60-second spoken diary that tracks your fluency", icon: Mic, color: "text-averna-pink", bg: "bg-averna-pink/15", group: "practice" },
  { slug: "roleplay", title: "Roleplay", blurb: "Chat in character — airport, interview, café and more", icon: Clapperboard, color: "text-averna-purple", bg: "bg-averna-purple/15", group: "practice" },
  { slug: "teach", title: "Teach to Learn", blurb: "Explain a concept and get a clarity score", icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-400/15", group: "practice" },
  { slug: "mistakes", title: "Correction Studio", blurb: "Save, rewrite and revisit your own corrections across devices", icon: BookMarked, color: "text-averna-cyan", bg: "bg-averna-cyan/15", group: "practice" },
  { slug: "essay-xray", title: "Essay X-Ray", blurb: "Examiner-style diagnosis with issues highlighted", icon: ScanLine, color: "text-averna-cyan", bg: "bg-averna-cyan/15", group: "practice" },
  { slug: "podcast", title: "Daily Podcast", blurb: "90 seconds on your weakest skill, read aloud", icon: Headphones, color: "text-averna-purple", bg: "bg-averna-purple/15", group: "practice" },
  { slug: "focus", title: "Focus Room", blurb: "A Pomodoro timer and the deep-focus vault", icon: Timer, color: "text-averna-neon", bg: "bg-averna-neon/15", group: "practice" },
  { slug: "word-duel", title: "Word Duel", blurb: "Today's 10 words against your best run", icon: Swords, color: "text-averna-pink", bg: "bg-averna-pink/15", group: "games" },
  { slug: "boss-battle", title: "Boss Battle", blurb: "Defeat a boss built from your own mistakes", icon: Skull, color: "text-red-400", bg: "bg-red-400/15", group: "games" },
  { slug: "ghost-race", title: "Ghost Race", blurb: "A timed vocabulary sprint against your ghost", icon: Ghost, color: "text-averna-cyan", bg: "bg-averna-cyan/15", group: "games" },
  { slug: "confidence", title: "Confidence Meter", blurb: "Bet on your answers and calibrate your gut", icon: Gauge, color: "text-amber-400", bg: "bg-amber-400/15", group: "games" },
];

export function studioTool(slug: string): StudioTool {
  const tool = STUDIO_TOOLS.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown studio tool: ${slug}`);
  return tool;
}
