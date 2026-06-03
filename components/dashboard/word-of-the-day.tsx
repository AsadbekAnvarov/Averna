import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck, Sparkles } from "lucide-react";

interface VocabEntry {
  word: string;
  ipa: string;
  pos: string;
  definition: string;
  example: string;
  synonyms: string[];
}

// Curated IELTS-level vocabulary. One is shown per day (deterministic).
const VOCAB: VocabEntry[] = [
  { word: "Ubiquitous", ipa: "/juːˈbɪkwɪtəs/", pos: "adjective", definition: "Present, appearing, or found everywhere.", example: "Smartphones have become ubiquitous in modern life.", synonyms: ["omnipresent", "pervasive", "widespread"] },
  { word: "Meticulous", ipa: "/məˈtɪkjələs/", pos: "adjective", definition: "Showing great attention to detail; very careful and precise.", example: "She kept meticulous records of her study progress.", synonyms: ["thorough", "scrupulous", "diligent"] },
  { word: "Pragmatic", ipa: "/præɡˈmætɪk/", pos: "adjective", definition: "Dealing with things sensibly and realistically.", example: "We need a pragmatic approach to solving this problem.", synonyms: ["practical", "realistic", "sensible"] },
  { word: "Resilient", ipa: "/rɪˈzɪliənt/", pos: "adjective", definition: "Able to recover quickly from difficulties.", example: "Resilient learners treat mistakes as feedback.", synonyms: ["tough", "adaptable", "hardy"] },
  { word: "Eloquent", ipa: "/ˈeləkwənt/", pos: "adjective", definition: "Fluent or persuasive in speaking or writing.", example: "His eloquent essay impressed the examiner.", synonyms: ["articulate", "expressive", "fluent"] },
  { word: "Inevitable", ipa: "/ɪnˈevɪtəbl/", pos: "adjective", definition: "Certain to happen; unavoidable.", example: "Some level of stress is inevitable before an exam.", synonyms: ["unavoidable", "certain", "inescapable"] },
  { word: "Profound", ipa: "/prəˈfaʊnd/", pos: "adjective", definition: "Very great or intense; showing deep insight.", example: "Reading had a profound effect on her writing.", synonyms: ["deep", "intense", "insightful"] },
  { word: "Versatile", ipa: "/ˈvɜːsətaɪl/", pos: "adjective", definition: "Able to adapt to many different functions or activities.", example: "A versatile vocabulary helps in every IELTS section.", synonyms: ["adaptable", "flexible", "all-round"] },
  { word: "Diligent", ipa: "/ˈdɪlɪdʒənt/", pos: "adjective", definition: "Having or showing care and conscientiousness.", example: "Diligent daily practice beats last-minute cramming.", synonyms: ["hard-working", "industrious", "assiduous"] },
  { word: "Coherent", ipa: "/kəʊˈhɪərənt/", pos: "adjective", definition: "Logical and consistent; clearly connected.", example: "A coherent essay guides the reader from point to point.", synonyms: ["logical", "consistent", "organised"] },
  { word: "Substantial", ipa: "/səbˈstænʃl/", pos: "adjective", definition: "Of considerable importance, size, or worth.", example: "She made substantial progress in just one month.", synonyms: ["considerable", "significant", "sizeable"] },
  { word: "Ambiguous", ipa: "/æmˈbɪɡjuəs/", pos: "adjective", definition: "Open to more than one interpretation; unclear.", example: "Avoid ambiguous phrases in academic writing.", synonyms: ["unclear", "vague", "equivocal"] },
  { word: "Compelling", ipa: "/kəmˈpelɪŋ/", pos: "adjective", definition: "Evoking interest or attention; convincing.", example: "He gave a compelling argument for renewable energy.", synonyms: ["convincing", "persuasive", "gripping"] },
  { word: "Tedious", ipa: "/ˈtiːdiəs/", pos: "adjective", definition: "Too long, slow, or dull; tiresome.", example: "Memorising lists can feel tedious but it pays off.", synonyms: ["boring", "monotonous", "dull"] },
];

function getDayIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % VOCAB.length;
}

export function WordOfTheDay() {
  const entry = VOCAB[getDayIndex()];

  return (
    <Card className="glass border-averna-cyan/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-averna-cyan/10 to-transparent" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <BookOpenCheck className="h-5 w-5" />
          Word of the Day
        </CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-3">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold text-white">{entry.word}</span>
            <span className="text-sm text-gray-400">{entry.ipa}</span>
          </div>
          <span className="text-xs uppercase tracking-wide text-averna-neon">{entry.pos}</span>
        </div>

        <p className="text-gray-200 text-sm">{entry.definition}</p>

        <div className="bg-averna-primary/20 rounded-lg p-3 border border-averna-primary/30">
          <p className="text-sm italic text-gray-300">
            <Sparkles className="inline h-3.5 w-3.5 text-averna-pink mr-1" />
            &ldquo;{entry.example}&rdquo;
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {entry.synonyms.map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-1 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/30"
            >
              {s}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
