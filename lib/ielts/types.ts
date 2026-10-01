/**
 * IELTS exam-format content — format "exam-v2".
 *
 * Mirrors how the real computer-delivered IELTS is organised: a test has PARTS
 * (3 Reading passages / 4 Listening parts), each part has QUESTION GROUPS that
 * share one instruction block ("Questions 1–6 … Write TRUE, FALSE or NOT
 * GIVEN"), and every question carries a global number 1–40. Grading, band
 * conversion, the CD-IELTS runners, the mock exam and the AI generator all speak
 * this one format.
 *
 * Pure types — safe to import anywhere (server, client, offline scripts).
 */

export type ExamSkill = "READING" | "LISTENING";
export type ExamDifficulty = "Easy" | "Medium" | "Hard";
/**
 * Where a test came from. "legacy" = converted from the old short practice format;
 * "cdi" = imported from the CDI practice materials (scripts/cdi/import.mjs).
 */
export type ExamSource = "averna" | "generated" | "legacy" | "cdi";

/** A picture that belongs to a question group (map / plan / diagram to label). */
export interface ExamImage {
  /** Public URL, e.g. "/cdi/images/listening3-map.webp". */
  src: string;
  alt: string;
}

export type GroupKind =
  | "tfng" // TRUE / FALSE / NOT GIVEN
  | "ynng" // YES / NO / NOT GIVEN
  | "mcq" // one answer, per-question options A–D
  | "mcq-multi" // choose N letters from one shared list; one mark per correct letter
  | "matching" // choose a key from a shared list (headings, paragraphs, people, endings…)
  | "gap" // type words: sentence / summary / notes / table / flow-chart / short answer
  | "gap-box"; // pick words (by key) from a box to complete a summary

export interface ExamOption {
  /** "A", "B" … for letters; "i", "ii" … for headings. */
  key: string;
  text: string;
}

export interface ExamQuestion {
  /** Global question number (1–40), ascending in document order. */
  n: number;
  /**
   * Statement / question stem / item to match (e.g. "Paragraph B").
   * For a "gap" group WITHOUT a template it must contain the placeholder
   * [[n]] where the answer goes, e.g. "The first bridge was built from [[3]]."
   */
  text?: string;
  /** Per-question options — "mcq" only (keys A–D). */
  options?: ExamOption[];
  /**
   * Accepted answers.
   * - tfng/ynng: ["TRUE"] / ["NOT GIVEN"] …
   * - mcq / matching / gap-box: the option key, e.g. ["B"] or ["iv"]
   * - mcq-multi: the FULL correct key set, identical on every question of the group, e.g. ["B","D"]
   * - gap: accepted spellings; "(the) river bank" marks optional words
   */
  answer: string[];
  /** One sentence justifying the answer from the text (shown after submission). */
  explanation?: string;
}

export interface ExamGroup {
  kind: GroupKind;
  /** e.g. "Do the following statements agree with the information given in Reading Passage 1?" */
  instructions: string;
  /** Bold answer rule. Derived from kind / wordLimit / allowNumber when omitted (see answerRuleFor). */
  answerRule?: string;
  /** gap: maximum words per answer (IELTS "NO MORE THAN TWO WORDS"). */
  wordLimit?: number;
  /** gap: "… AND/OR A NUMBER" — numbers don't count toward the word limit. */
  allowNumber?: boolean;
  /** Title of a summary / table / notes / flow-chart, or the mcq-multi question stem. */
  title?: string;
  /** Shared list for matching (headings i–x, paragraphs A–G, people A–E, endings A–G), mcq-multi (A–E) and gap-box (A–L word bank). */
  options?: ExamOption[];
  /** matching: "NB You may use any letter more than once." */
  allowReuse?: boolean;
  /**
   * gap / gap-box layout with [[n]] placeholders. One line per row:
   *   "# Heading"          → subheading
   *   "- text [[5]] text"  → bullet
   *   "| a | b [[6]] |"    → table row (the first table row is the header)
   *   anything else        → plain line / paragraph
   */
  template?: string;
  /** Map / plan / diagram shown with the group (e.g. "Label the map"). */
  image?: ExamImage;
  questions: ExamQuestion[];
}

export interface ExamParagraph {
  /** "A", "B" … when questions refer to paragraphs (matching headings / information). */
  label?: string;
  text: string;
}

export interface ReadingPart {
  id: string;
  /** Passage title. */
  title: string;
  subtitle?: string;
  paragraphs: ExamParagraph[];
  groups: ExamGroup[];
}

export interface ExamReadingTest {
  format: "exam-v2";
  skill: "READING";
  id: string;
  title: string;
  description: string;
  difficulty: ExamDifficulty;
  /** Minutes for the whole test (60 for a full Academic test). */
  timeLimit: number;
  topics?: string[];
  source: ExamSource;
  parts: ReadingPart[];
}

export type VoiceGender = "female" | "male";
export type VoiceAccent = "british" | "american" | "australian";

export interface ListeningSpeaker {
  /** Name used in ScriptLine.speaker, e.g. "Receptionist", "Tom". */
  name: string;
  gender: VoiceGender;
  accent?: VoiceAccent;
}

export interface ScriptLine {
  /** A name from the part's `speakers`, or "Narrator" for exam announcements. */
  speaker: string;
  text: string;
  /** Silent pause AFTER this line, in seconds (e.g. time to read the next questions). */
  pauseAfter?: number;
}

export interface ListeningPart {
  id: string;
  /** "Part 1" … "Part 4". */
  title: string;
  /** One sentence describing the situation, read before the recording. */
  context: string;
  speakers: ListeningSpeaker[];
  script: ScriptLine[];
  groups: ExamGroup[];
  /**
   * Transcript of a REAL recording ("Speaker: text" lines, plain text). Used
   * when the test ships with `ExamListeningTest.audio` and `speakers`/`script`
   * are empty. Contains every gap answer, so it must never reach the client
   * before submission.
   */
  transcript?: string;
}

/** One real recording for the whole Listening test (all four parts in one file). */
export interface ListeningTestAudio {
  /** File name only, e.g. "listening-1.mp3" (hosting / base URL decided by the app). */
  file: string;
  durationSec?: number;
  /** Seconds where each part starts in the file (4 entries) — approximate, from the transcript cues. */
  partStarts?: number[];
  /** Question number → second at which the answer is spoken. */
  questionTimes?: Record<number, number>;
}

export interface ExamListeningTest {
  format: "exam-v2";
  skill: "LISTENING";
  id: string;
  title: string;
  description: string;
  difficulty: ExamDifficulty;
  topics?: string[];
  source: ExamSource;
  parts: ListeningPart[];
  /** Real recording (e.g. imported CDI tests). When set, parts may have empty `speakers` / `script`. */
  audio?: ListeningTestAudio;
}

export type ExamTest = ExamReadingTest | ExamListeningTest;

/** A full IELTS Speaking test (Parts 1–3, 11–14 minutes). */
export interface SpeakingExamSet {
  format: "exam-v2";
  skill: "SPEAKING";
  id: string;
  title: string;
  source: ExamSource;
  /** Part 1: 2–3 familiar topics, 3–5 short questions each. */
  part1: { topic: string; questions: string[] }[];
  /** Part 2 cue card: "Describe …" + "You should say:" points + closing "and explain …". */
  part2: { cue: string; points: string[]; closing: string; followUp?: string };
  /** Part 3: abstract discussion linked to the Part 2 theme, 4–6 questions. */
  part3: { theme: string; questions: string[] };
}

/**
 * Student answers keyed by question number as a string ("14").
 * mcq-multi: an array of chosen keys stored under the group's FIRST question number.
 */
export type ExamAnswers = Record<string, string | string[]>;

/** Cheap summary for lists and pickers (no passages / scripts / answers). */
export interface ExamTestSummary {
  id: string;
  skill: ExamSkill;
  title: string;
  description: string;
  difficulty: ExamDifficulty;
  questions: number;
  parts: number;
  /** Per part: title + question range, e.g. { title: "The Silk Moth", from: 1, to: 13 }. */
  partInfo: { title: string; from: number; to: number }[];
  /** Minutes (Reading: time limit; Listening: estimated audio + review time). */
  timeLimit: number;
  kinds: GroupKind[];
  /** Full exam format (Reading: 3 passages / Listening: 4 parts, 40 questions) — eligible for the mock exam. */
  full: boolean;
  source: ExamSource;
  topics?: string[];
}

// ---------------------------------------------------------------------------
// Client-safe shapes: answer keys and explanations removed (anti-cheat).
// ---------------------------------------------------------------------------

export type ClientQuestion = Omit<ExamQuestion, "answer" | "explanation">;
export type ClientGroup = Omit<ExamGroup, "questions"> & { questions: ClientQuestion[] };
export type ClientReadingPart = Omit<ReadingPart, "groups"> & { groups: ClientGroup[] };
export type ClientReadingTest = Omit<ExamReadingTest, "parts"> & { parts: ClientReadingPart[] };
/** Pre-rendered recording of one Listening part (announcements, voices and pauses baked in). */
export interface ListeningPartAudio {
  url: string;
  durationMs: number;
  /** Where each script line sits in the file (i = script line index; -1 = an exam announcement). */
  timeline: {
    i: number;
    startMs: number;
    endMs: number;
    /** Which announcement (i = -1): part intro, reading-time preview, end of part, end of the test. */
    kind?: "intro" | "preview" | "end" | "final";
  }[];
}
/**
 * A part as sent to the browser. With `audio` the script is omitted (empty
 * array): the recording plays from the file and the transcript — which
 * contains every gap answer — never reaches the client.
 */
export type ClientListeningPart = Omit<ListeningPart, "groups"> & { groups: ClientGroup[]; audio?: ListeningPartAudio };
/**
 * The one real recording of a whole test (ExamListeningTest.audio) as sent to
 * the browser: its URL and the public timing only. `questionTimes` (where each
 * answer is spoken) and the parts' `transcript` stay on the server until the
 * attempt is submitted.
 */
export interface ListeningRecording {
  url: string;
  durationSec?: number;
  /** Seconds where each part starts in the file (one per part, ascending) — approximate. */
  partStarts?: number[];
}
export type ClientListeningTest = Omit<ExamListeningTest, "parts"> & {
  parts: ClientListeningPart[];
  /** Set for a test with one real recording (CDI): the runner plays this file for every part. */
  recording?: ListeningRecording;
};

/** Result of grading one question (server-side). */
export interface GradeItem {
  n: number;
  kind: GroupKind;
  correct: boolean;
  /** What the student answered (display form; "" when blank). */
  given: string;
  /** The primary accepted answer (display form). */
  expected: string;
  /** All accepted answers (display form). */
  accepted: string[];
  explanation?: string;
  /** Answer exceeded the group's word limit (counted wrong, as in the real exam). */
  overLimit?: boolean;
}

export interface GradeResult {
  correct: number;
  total: number;
  answered: number;
  items: GradeItem[];
  byKind: Partial<Record<GroupKind, { correct: number; total: number }>>;
}
