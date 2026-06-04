import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date helpers
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Calculate IELTS band score from percentage
export function calculateBandScore(percentage: number): number {
  if (percentage >= 90) return 9.0;
  if (percentage >= 80) return 8.0;
  if (percentage >= 70) return 7.0;
  if (percentage >= 60) return 6.5;
  if (percentage >= 50) return 6.0;
  if (percentage >= 40) return 5.5;
  if (percentage >= 30) return 5.0;
  return 4.5;
}

// Points calculation helpers
export function calculateHomeworkPoints(position: number, basePoints: number): number {
  if (position === 1) return basePoints + 10;
  if (position === 2) return basePoints + 8;
  if (position === 3) return basePoints + 6;
  return basePoints;
}

// Time helpers for Speaking Time feature
export function isSpeakingTime(): boolean {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 19 && hours < 21;
}

export function getTimeUntilSpeakingTime(): string {
  const now = new Date();
  const hours = now.getHours();
  
  if (hours >= 19 && hours < 21) {
    return "Speaking Time is NOW!";
  }
  
  if (hours < 19) {
    const hoursUntil = 19 - hours;
    return `Speaking Time starts in ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`;
  }
  
  return "Speaking Time starts tomorrow at 19:00";
}

// Motivational quotes
export const motivationalQuotes = [
  "Success is the sum of small efforts repeated every day.",
  "Your future IELTS score depends on today's effort.",
  "Every expert was once a beginner. Keep pushing!",
  "The only way to do great work is to love what you do.",
  "Believe in yourself and all that you are.",
  "Your limitation—it's only your imagination.",
  "Dream bigger. Do bigger.",
  "Success doesn't just find you. You have to go out and get it.",
  "The harder you work for something, the greater you'll feel when you achieve it.",
  "Don't stop when you're tired. Stop when you're done.",
];

export function getRandomQuote(): string {
  return motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
}


// ===== Learner Level system (shared) =====
export interface LevelInfo {
  level: number;
  title: string;
  base: number;
  next: number;
  into: number; // percent progress into the current level (0-100)
}

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];
const LEVEL_TITLES = [
  "Rookie",
  "Explorer",
  "Achiever",
  "Skilled",
  "Advanced",
  "Expert",
  "Master",
  "Champion",
  "Legend",
  "IELTS Pro",
];

export function getLevelInfo(points: number): LevelInfo {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const idx = level - 1;
  const base = LEVEL_THRESHOLDS[idx] ?? 0;
  const next = LEVEL_THRESHOLDS[idx + 1] ?? base + 1000;
  const into =
    next > base ? Math.min(100, Math.round(((points - base) / (next - base)) * 100)) : 100;
  return { level, title: LEVEL_TITLES[idx] ?? "IELTS Pro", base, next, into };
}


// ===== Lightweight writing band estimator (no external deps) =====
// Used by the Mock Exam to estimate a Writing band from the essay text.
export function heuristicWritingAssessmentSafe(essay: string): number {
  const text = (essay || "").trim();
  if (!text) return 3.5;

  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const avgSentenceLen = wordCount / sentenceCount;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
  const lexicalDiversity = wordCount > 0 ? uniqueWords / wordCount : 0;

  const linkers = [
    "however", "moreover", "furthermore", "therefore", "in addition",
    "for example", "for instance", "on the other hand", "in conclusion",
    "firstly", "secondly", "finally", "although", "whereas", "because",
  ];
  const lower = text.toLowerCase();
  const linkerCount = linkers.filter((l) => lower.includes(l)).length;

  // Base band from length toward the 250-word Task 2 target
  let band = 4;
  if (wordCount >= 250) band = 6.5;
  else if (wordCount >= 200) band = 6;
  else if (wordCount >= 150) band = 5.5;
  else if (wordCount >= 100) band = 5;
  else if (wordCount >= 50) band = 4.5;

  // Adjust for vocabulary range, cohesion and sentence variety
  if (lexicalDiversity > 0.55) band += 0.5;
  if (linkerCount >= 4) band += 0.5;
  if (avgSentenceLen >= 10 && avgSentenceLen <= 22) band += 0.5;

  band = Math.max(3.5, Math.min(8.5, band));
  return Math.round(band * 2) / 2;
}


// ===== Anti-cheat: effort validation =====
// Returns true if a piece of writing shows genuine effort (not blank,
// not a few random characters, not the prompt copied back, etc.)
export function isGenuineWriting(essay: string, minWords = 40): boolean {
  const text = (essay || "").trim();
  if (text.length < 20) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < minWords) return false;
  // Reject if it's the same word/char repeated (e.g. "aaaa", "test test test")
  const unique = new Set(words.map((w) => w.toLowerCase()));
  if (unique.size < Math.max(8, Math.floor(words.length * 0.3))) return false;
  // Reject if there's no alphabetic content
  if (!/[a-zA-Z]{3,}/.test(text)) return false;
  return true;
}


// ===== Band prediction (#11) =====
// Predicts a target band from recent test scores using a simple weighted
// trend (recent results weigh more) + a small momentum bonus if improving.
export interface BandPrediction {
  current: number;   // weighted current level
  predicted: number; // projected band with continued practice
  trend: "up" | "down" | "flat";
  confidence: "low" | "medium" | "high";
  sampleSize: number;
}

export function predictBand(scores: number[]): BandPrediction | null {
  const valid = scores.filter((s) => typeof s === "number" && s > 0);
  if (valid.length === 0) return null;

  // Weighted average: most recent scores (end of array) weigh more
  let wsum = 0;
  let w = 0;
  valid.forEach((s, i) => {
    const weight = i + 1;
    wsum += s * weight;
    w += weight;
  });
  const current = wsum / w;

  // Trend: compare first third vs last third
  const third = Math.max(1, Math.floor(valid.length / 3));
  const early = valid.slice(0, third);
  const late = valid.slice(-third);
  const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length;
  const lateAvg = late.reduce((a, b) => a + b, 0) / late.length;
  const delta = lateAvg - earlyAvg;

  let trend: BandPrediction["trend"] = "flat";
  if (delta > 0.2) trend = "up";
  else if (delta < -0.2) trend = "down";

  // Projected band: current + momentum (capped), rounded to nearest 0.5
  const momentum = trend === "up" ? Math.min(1, delta) : trend === "down" ? Math.max(-0.5, delta) : 0.25;
  const predictedRaw = Math.min(9, Math.max(1, current + momentum));
  const predicted = Math.round(predictedRaw * 2) / 2;

  const confidence = valid.length >= 8 ? "high" : valid.length >= 4 ? "medium" : "low";

  return {
    current: Math.round(current * 2) / 2,
    predicted,
    trend,
    confidence,
    sampleSize: valid.length,
  };
}

// ===== CSV helper (#22) =====
export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}


// ===== AI Speaking Examiner scoring (#1) =====
export interface SpeakingScore {
  fluency: number;       // 0-9
  vocabulary: number;    // 0-9
  grammar: number;       // 0-9
  overall: number;       // 0-9
  wordCount: number;
  feedback: string[];
}

// Scores a transcript of spoken English using simple, transparent heuristics.
export function scoreSpeaking(transcript: string, seconds: number): SpeakingScore {
  const text = (transcript || "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const minutes = Math.max(0.1, seconds / 60);
  const wpm = wordCount / minutes;

  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, "")));
  const diversity = wordCount > 0 ? unique.size / wordCount : 0;

  const linkers = ["because", "however", "although", "for example", "such as", "therefore", "in addition", "on the other hand", "firstly", "finally", "in my opinion"];
  const lower = text.toLowerCase();
  const linkerCount = linkers.filter((l) => lower.includes(l)).length;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgLen = wordCount / Math.max(1, sentences.length);

  const clamp = (n: number) => Math.max(3, Math.min(8.5, Math.round(n * 2) / 2));

  // Fluency: based on speaking rate (ideal ~110-150 wpm) and amount spoken
  let fluency = 4;
  if (wpm >= 100 && wpm <= 170) fluency = 7;
  else if (wpm >= 80) fluency = 6;
  else if (wpm >= 50) fluency = 5;
  if (wordCount < 20) fluency = Math.min(fluency, 4);
  fluency = clamp(fluency + (linkerCount >= 2 ? 0.5 : 0));

  // Vocabulary: lexical diversity + linking phrases
  const vocabulary = clamp(4 + diversity * 5 + Math.min(1, linkerCount * 0.25));

  // Grammar: reasonable sentence length + variety (proxy)
  const grammar = clamp(4.5 + (avgLen >= 8 && avgLen <= 22 ? 1.5 : 0.5) + (sentences.length >= 3 ? 0.5 : 0));

  const overall = Math.round(((fluency + vocabulary + grammar) / 3) * 2) / 2;

  const feedback: string[] = [];
  if (wordCount < 40) feedback.push("Try to speak more — aim for at least a minute of continuous speech.");
  if (wpm < 80) feedback.push("Your pace was a little slow. Practise speaking more smoothly without long pauses.");
  if (wpm > 180) feedback.push("You spoke very fast — slow down slightly for clarity.");
  if (diversity < 0.5) feedback.push("Use a wider range of vocabulary and avoid repeating the same words.");
  if (linkerCount < 2) feedback.push("Use more linking phrases (however, for example, because) to connect ideas.");
  if (feedback.length === 0) feedback.push("Great job! Keep practising daily to push your band even higher.");

  return { fluency, vocabulary, grammar, overall, wordCount, feedback };
}
