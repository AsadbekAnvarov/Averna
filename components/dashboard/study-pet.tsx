import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

interface Props {
  streak: number;
  points: number;
}

interface Stage {
  emoji: string;
  name: string;
  min: number; // points threshold
  mood: string;
}

const STAGES: Stage[] = [
  { emoji: "🥚", name: "Egg", min: 0, mood: "Keep studying to hatch me!" },
  { emoji: "🐣", name: "Hatchling", min: 100, mood: "Yay, I hatched! Let's learn!" },
  { emoji: "🐥", name: "Chick", min: 300, mood: "I'm growing fast thanks to you!" },
  { emoji: "🦉", name: "Wise Owl", min: 700, mood: "We're getting smart together!" },
  { emoji: "🦅", name: "Eagle", min: 1500, mood: "We're soaring high!" },
  { emoji: "🐉", name: "Dragon", min: 3000, mood: "Unstoppable! Roar!" },
];

export function StudyPet({ streak, points }: Props) {
  let stageIdx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (points >= STAGES[i].min) stageIdx = i;
  }
  const stage = STAGES[stageIdx];
  const next = STAGES[stageIdx + 1];
  const into = next
    ? Math.min(100, Math.round(((points - stage.min) / (next.min - stage.min)) * 100))
    : 100;

  // Pet "happiness" reflects the current streak
  const hearts = Math.min(5, Math.ceil(streak / 3));

  // Mood reflects daily consistency — emotional attachment that pulls you back
  const mood =
    streak === 0
      ? { label: "Misses you", face: "😢", glow: "grayscale opacity-80", note: "I miss our daily sessions — study a little today to cheer me up!" }
      : streak < 3
      ? { label: "Content", face: "🙂", glow: "", note: stage.mood }
      : streak < 7
      ? { label: "Happy", face: "😄", glow: "", note: "You're so consistent — I'm thriving!" }
      : { label: "Thrilled", face: "🤩", glow: "drop-shadow-[0_0_12px_rgba(236,72,153,0.6)]", note: "On fire! Our streak makes me unstoppable!" };

  return (
    <Card className="glass border-averna-pink/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-averna-pink/10 to-transparent" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2 text-averna-pink">
          <Heart className="h-5 w-5" /> Study Buddy
        </CardTitle>
      </CardHeader>
      <CardContent className="relative text-center">
        <div className={`text-6xl mb-2 animate-float ${mood.glow}`}>{stage.emoji}</div>
        <p className="text-white font-bold flex items-center justify-center gap-1.5">
          {stage.name}
          <span className="text-xs font-normal text-averna-pink">{mood.face} {mood.label}</span>
        </p>
        <p className="text-xs text-gray-400 italic mb-3">&ldquo;{mood.note}&rdquo;</p>

        {/* Happiness hearts */}
        <div className="flex justify-center gap-0.5 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Heart
              key={i}
              className={`h-4 w-4 ${i < hearts ? "text-averna-pink fill-averna-pink" : "text-gray-600"}`}
            />
          ))}
        </div>

        {next ? (
          <div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-averna-pink to-averna-purple transition-all duration-700"
                style={{ width: `${into}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {next.min - points} pts to evolve into {next.emoji} {next.name}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-averna-neon">Max evolution reached! 🎉</p>
        )}
      </CardContent>
    </Card>
  );
}
