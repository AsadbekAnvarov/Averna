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
