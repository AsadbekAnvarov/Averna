import { Card, CardContent } from "@/components/ui/card";
import { Library, FileText, Clapperboard, Layers, Trophy, GraduationCap } from "lucide-react";
import Link from "next/link";

const RESOURCES = [
  { href: "/materials", label: "Materials", desc: "IELTS guides & tips", icon: Library, color: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
  { href: "/article", label: "Daily Article", desc: "Read & learn words", icon: FileText, color: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
  { href: "/movies", label: "Movies", desc: "Learn with subtitles", icon: Clapperboard, color: "bg-averna-pink/15 text-averna-pink", hover: "hover:border-averna-pink/40" },
  { href: "/flashcards", label: "Flashcards", desc: "Build your vocabulary", icon: Layers, color: "bg-emerald-400/15 text-emerald-400", hover: "hover:border-emerald-400/40" },
  { href: "/learning/mock-exam", label: "Mock Exam", desc: "Full practice test", icon: Trophy, color: "bg-amber-400/15 text-amber-400", hover: "hover:border-amber-400/40" },
  { href: "/tutoring", label: "1-on-1 Tutoring", desc: "Book a session", icon: GraduationCap, color: "bg-averna-blue/15 text-averna-blue", hover: "hover:border-averna-blue/40" },
];

/**
 * Resources hub — a single, scannable entry point to all the learning material
 * (materials bank, daily article, movies, flashcards, mock exam, tutoring).
 */
export function ResourcesHub() {
  return (
    <Card className="glass border-averna-primary/30">
      <CardContent className="pt-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {RESOURCES.map((r) => {
            const Icon = r.icon;
            return (
              <Link key={r.href} href={r.href} className="group">
                <div className={`flex items-center gap-4 p-4 rounded-xl bg-averna-dark/30 border border-white/5 transition-all duration-300 hover:bg-averna-dark/50 hover:-translate-y-0.5 ${r.hover}`}>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${r.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm truncate">{r.label}</p>
                    <p className="text-xs text-gray-400 truncate">{r.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
