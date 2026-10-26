import { Sparkles, MessageSquare, Bot, ScanLine, Clapperboard, Dna, Users, UserCheck, type LucideIcon } from "lucide-react";

export type CoachGroup = "ai" | "people";

export interface CoachTool {
  name: string;
  href: string;
  icon: LucideIcon;
  /** One line: "Use it when …". */
  useWhen: string;
  /** Primary link label. */
  cta: string;
  group: CoachGroup;
  /** Extra palette search words (lowercase). */
  keywords: string;
  /** Genuinely new on this branch (badge expires with NEW_BADGE_UNTIL). */
  fresh?: boolean;
  /** Icon tint (text-*) and its tinted badge background (bg-*). */
  tone: string;
}

/**
 * The AI Coach hub (/coach): every AI helper and the people who coach you,
 * each with one clear purpose. The tools keep their own pages; this is the
 * single front door the sidebar and the phone tab bar point to.
 */
export const COACH_TOOLS: CoachTool[] = [
  {
    name: "Averna AI",
    href: "/dashboard?tab=learn",
    icon: Sparkles,
    useWhen: "Use it when you want advice based on your own scores, streak and weakest skill.",
    cta: "Ask Averna AI",
    group: "ai",
    keywords: "averna ai chat assistant personal plan advice tutor",
    tone: "bg-averna-neon/15 text-averna-neon",
  },
  {
    name: "AI Mentor",
    href: "/mentor",
    icon: MessageSquare,
    useWhen: "Use it when you have a quick question about grammar, words or IELTS tips.",
    cta: "Ask the mentor",
    group: "ai",
    keywords: "mentor ask help chatbot assistant question grammar tips",
    tone: "bg-averna-pink/15 text-averna-pink",
  },
  {
    name: "AI Examiner",
    href: "/learning/examiner",
    icon: Bot,
    useWhen: "Use it when you want a band estimate for an answer you speak out loud.",
    cta: "Start speaking",
    group: "ai",
    keywords: "examiner speaking band score assess feedback test",
    tone: "bg-averna-cyan/15 text-averna-cyan",
  },
  {
    name: "Essay X-Ray",
    href: "/studio/essay-xray",
    icon: ScanLine,
    useWhen: "Use it when you have written an essay and want examiner-style notes on it.",
    cta: "Check an essay",
    group: "ai",
    keywords: "essay xray x-ray writing check feedback diagnosis task 2",
    tone: "bg-averna-purple/15 text-averna-purple",
  },
  {
    name: "Roleplay",
    href: "/studio/roleplay",
    icon: Clapperboard,
    useWhen: "Use it when you want to practise a real-life conversation in character.",
    cta: "Pick a scene",
    group: "ai",
    keywords: "roleplay role play conversation chat airport interview restaurant",
    tone: "bg-amber-400/15 text-amber-400",
  },
  {
    name: "Learning DNA",
    href: "/learning-dna",
    icon: Dna,
    useWhen: "Use it when you want study tips that fit the way you learn best.",
    cta: "See my DNA",
    group: "ai",
    keywords: "learning dna how i learn style focus retention motivation profile",
    tone: "bg-averna-cyan/15 text-averna-cyan",
  },
  {
    name: "Speaking partner",
    href: "/learning/speaking",
    icon: Users,
    useWhen: "Use it when you want to talk with a classmate and swap feedback.",
    cta: "Find a partner",
    group: "people",
    keywords: "speaking partner peer classmate talk conversation practice",
    fresh: true,
    tone: "bg-averna-neon/15 text-averna-neon",
  },
  {
    name: "1-on-1 tutoring",
    href: "/tutoring",
    icon: UserCheck,
    useWhen: "Use it when you want a teacher's full attention for focused practice.",
    cta: "Book a slot",
    group: "people",
    keywords: "tutoring tutor second teacher book lesson one to one",
    tone: "bg-averna-purple/15 text-averna-purple",
  },
];
