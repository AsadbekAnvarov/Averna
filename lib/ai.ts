import OpenAI from "openai";
import { readingTestSchema, type GeneratedReadingTest } from "@/lib/test-schema";

// Lazy initialization - only create OpenAI client when actually needed
let openai: OpenAI | null = null;

/** True only when a real OpenAI key is configured. */
export function hasOpenAI(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key.length > 20 && !key.includes("placeholder");
}

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY || "placeholder-key-for-build";
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

export interface WritingAssessment {
  taskAchievement: number; // 0-9
  coherenceCohesion: number; // 0-9
  lexicalResource: number; // 0-9
  grammarAccuracy: number; // 0-9
  overallBand: number; // 0-9
  aiDetectionScore: number; // 0-100 (percentage of AI-generated)
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  detailedFeedback: string;
  issues?: WritingIssue[]; // inline highlights for the Writing Heatmap
}

export async function assessWritingTask(
  essay: string,
  taskType: "task1" | "task2",
  prompt: string
): Promise<WritingAssessment> {
  // Offline fallback: heuristic assessment when no OpenAI key is configured
  if (!hasOpenAI()) {
    return heuristicWritingAssessment(essay, taskType);
  }

  const systemPrompt = `You are an expert IELTS Writing examiner. Assess the following ${taskType === "task1" ? "Task 1" : "Task 2"} essay based on IELTS criteria:
  
1. Task Achievement (Task 1) / Task Response (Task 2): 0-9
2. Coherence and Cohesion: 0-9
3. Lexical Resource: 0-9
4. Grammatical Range and Accuracy: 0-9

Also detect if the essay appears to be AI-generated (0-100%).

Provide:
- Scores for each criterion
- Overall band score (average)
- 3-5 strengths
- 3-5 weaknesses
- 3-5 specific recommendations
- Detailed feedback paragraph
- 6-12 inline "issues". For each, "text" MUST be an EXACT substring copied verbatim from the essay (a word or short phrase, at most ~8 words) so it can be located and highlighted. Use type "good" to highlight 2-3 phrases the student used particularly well. Keep every "suggestion" to one short, concrete sentence.

Task Prompt: ${prompt}

Essay:
${essay}

Respond in JSON format:
{
  "taskAchievement": number,
  "coherenceCohesion": number,
  "lexicalResource": number,
  "grammarAccuracy": number,
  "overallBand": number,
  "aiDetectionScore": number,
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": string[],
  "detailedFeedback": string,
  "issues": [{ "text": string, "type": "grammar" | "vocabulary" | "spelling" | "cohesion" | "punctuation" | "good", "suggestion": string }]
}`;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = completion.choices[0].message.content;
    if (!result) throw new Error("No response from OpenAI");

    return JSON.parse(result) as WritingAssessment;
  } catch (error) {
    console.error("Error assessing writing:", error);
    throw new Error("Failed to assess writing task");
  }
}

export async function generateSpeakingQuestions(
  part: 1 | 2 | 3,
  topic?: string
): Promise<string[]> {
  const prompts = {
    1: "Generate 5 IELTS Speaking Part 1 questions about everyday topics (family, work, hobbies, etc.)",
    2: "Generate 1 IELTS Speaking Part 2 cue card with a topic, talking points, and follow-up question",
    3: `Generate 5 IELTS Speaking Part 3 questions about ${topic || "abstract concepts related to society"}`,
  };

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an IELTS Speaking examiner. Generate authentic IELTS speaking questions.",
        },
        { role: "user", content: prompts[part] },
      ],
      temperature: 0.7,
    });

    const result = completion.choices[0].message.content;
    if (!result) throw new Error("No response from OpenAI");

    return result.split("\n").filter((q) => q.trim().length > 0);
  } catch (error) {
    console.error("Error generating speaking questions:", error);
    throw new Error("Failed to generate speaking questions");
  }
}

export async function aiMentorChat(
  message: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  // Offline fallback: rule-based helpful answer when no OpenAI key is configured
  if (!hasOpenAI()) {
    return offlineMentorReply(message);
  }

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert IELTS tutor and English language mentor at Averna Learning Centre. 
          You help students with:
          - Grammar explanations
          - Vocabulary building
          - IELTS tips and strategies
          - Pronunciation guidance
          - Practice questions
          - Motivation and encouragement
          
          Be friendly, encouraging, and provide clear, actionable advice. Always relate answers back to IELTS success.`,
        },
        ...conversationHistory,
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0].message.content || "Sorry, I couldn't process that.";
  } catch (error) {
    console.error("Error in AI mentor chat:", error);
    throw new Error("Failed to get response from AI Mentor");
  }
}

export async function generatePersonalizedStudyPlan(
  studentData: {
    currentLevel: number; // IELTS band
    targetLevel: number;
    weakAreas: string[];
    availableHoursPerWeek: number;
  }
): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an IELTS study planner. Create personalized weekly study plans.",
        },
        {
          role: "user",
          content: `Create a personalized IELTS study plan for:
          - Current level: ${studentData.currentLevel}
          - Target level: ${studentData.targetLevel}
          - Weak areas: ${studentData.weakAreas.join(", ")}
          - Available time: ${studentData.availableHoursPerWeek} hours/week
          
          Provide a structured weekly plan with specific activities and time allocation.`,
        },
      ],
      temperature: 0.7,
    });

    return completion.choices[0].message.content || "Could not generate study plan.";
  } catch (error) {
    console.error("Error generating study plan:", error);
    throw new Error("Failed to generate study plan");
  }
}


// ============================================================
// Offline fallbacks (work without an OpenAI API key)
// ============================================================

/** Heuristic IELTS Writing assessment based on text metrics. */
export function heuristicWritingAssessment(
  essay: string,
  taskType: "task1" | "task2"
): WritingAssessment {
  const text = (essay || "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const avgSentenceLen = wordCount / sentenceCount;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
  const lexicalDiversity = wordCount > 0 ? uniqueWords / wordCount : 0;

  const minWords = taskType === "task1" ? 150 : 250;

  // Linking words usage
  const linkers = [
    "however", "moreover", "furthermore", "therefore", "in addition",
    "for example", "for instance", "on the other hand", "in conclusion",
    "firstly", "secondly", "finally", "although", "whereas", "because",
  ];
  const lower = text.toLowerCase();
  const linkerCount = linkers.filter((l) => lower.includes(l)).length;

  // Score each criterion (0-9), clamped
  const clamp = (n: number) => Math.max(3, Math.min(8.5, Math.round(n * 2) / 2));

  const lengthScore = wordCount >= minWords ? 6.5 : 4 + (wordCount / minWords) * 2.5;
  const taskAchievement = clamp(lengthScore);
  const coherenceCohesion = clamp(4.5 + Math.min(2.5, linkerCount * 0.5) + (avgSentenceLen > 8 && avgSentenceLen < 25 ? 0.5 : 0));
  const lexicalResource = clamp(4 + lexicalDiversity * 6);
  const grammarAccuracy = clamp(4.5 + (avgSentenceLen > 8 && avgSentenceLen < 22 ? 1.5 : 0.5) + Math.min(1, linkerCount * 0.2));
  const overallBand = Math.round(((taskAchievement + coherenceCohesion + lexicalResource + grammarAccuracy) / 4) * 2) / 2;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  if (wordCount >= minWords) strengths.push(`Good length — you wrote ${wordCount} words (minimum ${minWords}).`);
  else weaknesses.push(`Too short — ${wordCount}/${minWords} words. Aim for at least ${minWords}.`);

  if (linkerCount >= 4) strengths.push("Good use of linking words to connect ideas.");
  else recommendations.push("Use more cohesive devices (however, moreover, for instance, in conclusion).");

  if (lexicalDiversity > 0.5) strengths.push("Varied vocabulary — you avoid repeating the same words.");
  else recommendations.push("Increase vocabulary range; replace repeated words with synonyms.");

  if (avgSentenceLen > 25) weaknesses.push("Some sentences may be too long — break them up for clarity.");
  if (avgSentenceLen < 8) weaknesses.push("Sentences are quite short — combine ideas using complex structures.");

  recommendations.push("Proofread for articles (a/the), subject-verb agreement, and prepositions.");
  if (taskType === "task2") recommendations.push("Make sure each body paragraph has one clear main idea with examples.");

  return {
    taskAchievement,
    coherenceCohesion,
    lexicalResource,
    grammarAccuracy,
    overallBand,
    aiDetectionScore: 0,
    strengths: strengths.length ? strengths : ["You completed the task — keep practising!"],
    weaknesses: weaknesses.length ? weaknesses : ["Minor issues only — focus on refining vocabulary and grammar."],
    recommendations,
    detailedFeedback:
      `This is an automatic estimate based on length, vocabulary range, sentence variety and cohesion ` +
      `(your essay had ${wordCount} words, ${sentenceCount} sentences, ${linkerCount} linking expressions). ` +
      `Estimated band ${overallBand}. For a detailed examiner-style analysis, an OpenAI API key can be added in the site settings. ` +
      `Keep writing regularly — consistent practice is the fastest way to improve!`,
  };
}

/** Simple rule-based mentor reply used when no OpenAI key is configured. */
export function offlineMentorReply(message: string): string {
  const m = (message || "").toLowerCase();

  if (/(writing|essay|task 2|task 1)/.test(m)) {
    return "For IELTS Writing: 1) Plan for 3-4 minutes before writing. 2) Use a clear structure — introduction, 2 body paragraphs, conclusion. 3) Paraphrase the question in your introduction. 4) Support each point with a specific example. 5) Use cohesive devices (however, moreover, in conclusion). Aim for 250+ words in Task 2. Want me to suggest some useful linking phrases?";
  }
  if (/(speaking|pronunciation|fluency|accent)/.test(m)) {
    return "For IELTS Speaking: speak at a natural pace, don't memorise answers, and extend every answer with a reason or example. Try the 'PREP' method: Point, Reason, Example, Point. Practising out loud daily (and our Pronunciation Coach) will boost your fluency. What topic would you like practice questions for?";
  }
  if (/(reading)/.test(m)) {
    return "For IELTS Reading: skim first for the general idea, then scan for keywords. Don't read every word. Manage time — about 20 minutes per passage. Watch out for 'distractor' answers and synonyms of keywords. Practise 'True/False/Not Given' carefully — 'Not Given' means the text simply doesn't say.";
  }
  if (/(listening)/.test(m)) {
    return "For IELTS Listening: read the questions before the audio starts and predict the type of answer. Watch spelling and word limits. Stay focused — if you miss one, move on immediately. Our Listening practice reads passages aloud so you can train your ear.";
  }
  if (/(grammar)/.test(m)) {
    return "Grammar tip: mix simple and complex sentences. Common fixes — use articles (a/an/the), keep subject-verb agreement, and use the right tense consistently. For higher bands, use conditionals ('If I had...'), relative clauses ('which...'), and passive voice where appropriate. Send me a sentence and I'll explain how to improve it!";
  }
  if (/(vocab|word|synonym)/.test(m)) {
    return "Vocabulary tip: learn words in 'collocations' (groups), e.g. 'make a decision', 'take responsibility', 'a significant impact'. Check out our Flashcards and Word of the Day. Try to use 2-3 new words in your next piece of writing so they stick.";
  }
  if (/(band|score|7|8|target|goal)/.test(m)) {
    return "To raise your band: identify your weakest skill and focus 50% of your study there. Track progress with our tests, keep a daily streak, and review every mistake. Consistency beats intensity — 30 focused minutes a day works wonders. What's your target band?";
  }
  if (/(hello|hi|hey|salom|assalom|привет)/.test(m)) {
    return "Hello! 👋 I'm your IELTS mentor. Ask me anything about Writing, Reading, Listening, Speaking, grammar or vocabulary — or ask for study tips and practice questions. How can I help you today?";
  }

  return "Great question! Here's a general IELTS tip: study a little every day, focus on your weakest skill, and always review your mistakes. Ask me about Writing, Speaking, Reading, Listening, grammar, vocabulary, or how to reach your target band, and I'll give you specific advice. (Tip: connecting an OpenAI API key unlocks full AI-powered answers.)";
}


// ============================================================
// AI Homework generator (#3) — GPT-4 if key present, else templates
// ============================================================
export interface GeneratedHomework {
  title: string;
  description: string;
}

const HW_TEMPLATES: Record<string, GeneratedHomework[]> = {
  WRITING: [
    { title: "Writing Task 2: Technology & Society", description: "Some people believe technology makes us more connected, while others think it isolates us. Discuss both views and give your own opinion. Write at least 250 words." },
    { title: "Writing Task 2: Education", description: "Some think students should study subjects they enjoy; others say they should study useful subjects for their careers. Discuss both views and give your opinion. Write at least 250 words." },
    { title: "Writing Task 1: Describe a Graph", description: "The chart below shows the percentage of households with internet access in three countries between 2000 and 2020. Summarise the information by selecting and reporting the main features. Write at least 150 words." },
  ],
  READING: [
    { title: "Reading Practice: Skimming & Scanning", description: "Read the assigned passage and answer all True/False/Not Given and multiple-choice questions. Time yourself: 20 minutes. Note any unfamiliar vocabulary." },
    { title: "Reading: Matching Headings", description: "Complete the matching-headings exercise for the article on renewable energy. Explain why you chose each heading in one sentence." },
  ],
  LISTENING: [
    { title: "Listening: Section 2 Practice", description: "Complete one Listening test in the app, then write down 5 new words you heard and their meanings." },
    { title: "Listening: Note Completion", description: "Listen to the lecture twice and complete the note-taking exercise. Focus on numbers, dates and names." },
  ],
  SPEAKING: [
    { title: "Speaking: Part 2 Cue Card", description: "Record a 2-minute response to the cue card: 'Describe a skill you would like to learn.' Use the Pronunciation Coach to check clarity." },
    { title: "Speaking: Daily Topic Discussion", description: "Join a Speaking room (or practise with the app) and discuss today's topic for at least 5 minutes. Note 3 useful phrases you used." },
  ],
};

export async function generateHomework(
  module: string,
  level: string,
  topic?: string
): Promise<GeneratedHomework> {
  const mod = (module || "WRITING").toUpperCase();

  if (!hasOpenAI()) {
    const pool = HW_TEMPLATES[mod] ?? HW_TEMPLATES.WRITING;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return {
      title: topic ? `${pick.title} (${topic})` : pick.title,
      description: pick.description,
    };
  }

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an IELTS teacher creating homework. Respond in JSON: { \"title\": string, \"description\": string }. The description must be clear, specific instructions a student can follow." },
        { role: "user", content: `Create one ${mod} homework task for ${level} level students${topic ? ` about ${topic}` : ""}. Keep it realistic and exam-focused.` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });
    const result = completion.choices[0].message.content;
    if (!result) throw new Error("empty");
    const parsed = JSON.parse(result);
    return { title: parsed.title || "Homework", description: parsed.description || "" };
  } catch {
    const pool = HW_TEMPLATES[mod] ?? HW_TEMPLATES.WRITING;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}


// ============================================================
// AI essay error analysis (#4) — highlights likely issues
// ============================================================
export interface WritingIssue {
  text: string;       // the word/phrase flagged
  type: string;       // grammar | spelling | style | punctuation
  suggestion: string; // how to fix / improve
}

// Common, safe heuristic checks that work without any API key.
export function analyzeWritingIssues(essay: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
  const text = essay || "";
  const lower = text.toLowerCase();

  const checks: { re: RegExp; type: string; suggestion: string; label?: string }[] = [
    { re: /\bi\s/g, type: "grammar", suggestion: "The pronoun 'I' must always be capitalised.", label: "i" },
    { re: /\b(alot)\b/gi, type: "spelling", suggestion: "'alot' is not a word — write 'a lot'." },
    { re: /\b(recieve|recieved)\b/gi, type: "spelling", suggestion: "Spelling: 'receive' (i before e except after c)." },
    { re: /\b(definately)\b/gi, type: "spelling", suggestion: "Spelling: 'definitely'." },
    { re: /\b(beacuse|becuase)\b/gi, type: "spelling", suggestion: "Spelling: 'because'." },
    { re: /\b(thier)\b/gi, type: "spelling", suggestion: "Spelling: 'their'." },
    { re: /\b(teh)\b/gi, type: "spelling", suggestion: "Spelling: 'the'." },
    { re: /\b(very very|really really)\b/gi, type: "style", suggestion: "Avoid repetition — use a stronger adjective instead." },
    { re: /\b(in my opinion i think)\b/gi, type: "style", suggestion: "Redundant — use either 'In my opinion' or 'I think', not both." },
    { re: /\b(gonna|wanna|gotta|kinda)\b/gi, type: "style", suggestion: "Too informal for IELTS — write the full form (going to, want to)." },
    { re: /\s,/g, type: "punctuation", suggestion: "No space before a comma." },
    { re: /\s{2,}/g, type: "punctuation", suggestion: "Remove extra spaces." },
    { re: /[a-z]\.[A-Za-z]/g, type: "punctuation", suggestion: "Add a space after the full stop." },
  ];

  for (const c of checks) {
    const m = text.match(c.re);
    if (m && m.length > 0) {
      issues.push({ text: (c.label ?? m[0]).trim() || m[0], type: c.type, suggestion: c.suggestion });
    }
  }

  // Sentence length warning (run-on sentences)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const longOne = sentences.find((s) => s.split(/\s+/).filter(Boolean).length > 40);
  if (longOne) {
    issues.push({
      text: longOne.trim().slice(0, 40) + "…",
      type: "style",
      suggestion: "This sentence is very long. Consider splitting it for clarity.",
    });
  }

  // Repeated starting word
  const starts = sentences.map((s) => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const counts: Record<string, number> = {};
  starts.forEach((w) => { counts[w] = (counts[w] ?? 0) + 1; });
  const repeated = Object.entries(counts).find(([, n]) => n >= 3);
  if (repeated) {
    issues.push({
      text: repeated[0],
      type: "style",
      suggestion: `You start several sentences with '${repeated[0]}'. Vary your sentence openers.`,
    });
  }

  return issues.slice(0, 12);
}



/**
 * Generate a COMPLETE, fully ORIGINAL IELTS-style Academic Reading test.
 *
 * The model is instructed to invent brand-new passages and questions and must
 * never copy, translate or adapt any real, published or Cambridge exam text.
 * Output is validated against readingTestSchema before being returned.
 *
 * Notes for deployment:
 * - Requires OPENAI_API_KEY.
 * - A full 3-passage test is a large generation; on time-limited serverless
 *   plans, generate 1 passage per call (passageCount: 1) and assemble.
 */
export async function generateReadingTest(opts: {
  topic: string;
  level?: string;
  passageCount?: number;
  questionsPerPassage?: number;
  id?: string;
}): Promise<GeneratedReadingTest> {
  if (!hasOpenAI()) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY to generate tests.");
  }

  const passageCount = Math.min(3, Math.max(1, opts.passageCount ?? 3));
  const qpp = Math.min(14, Math.max(6, opts.questionsPerPassage ?? 13));
  const level = opts.level || "IELTS band 6.0-7.5";
  const id = opts.id || `gen-${Date.now()}`;
  const client = getOpenAIClient();

  const systemPrompt = `You are an expert IELTS item writer creating ORIGINAL practice material for a language school.
STRICT RULE: Never copy, translate, paraphrase or adapt any real, published or Cambridge IELTS passage or question. Everything must be brand-new writing invented by you.

Produce ${passageCount} passage(s) on the theme "${opts.topic}", ${level} difficulty:
- Each passage: 700-900 words, academic register, entirely original.
- Each passage: exactly ${qpp} questions, mixing "multiple-choice", "true-false-not-given" and "sentence-completion".
- multiple-choice: provide 4 "options"; "correctAnswer" = the 0-based index (number) of the correct option.
- true-false-not-given: "correctAnswer" = the string "true", "false" or "not-given".
- sentence-completion: "correctAnswer" = the exact answer word/phrase (string); put "___________" in the question where the gap is.
- Every question needs a one-sentence "explanation" justified by the passage.
- Question ids must be unique across the whole test: q1, q2, ... .

Return ONLY JSON matching exactly:
{"id":"${id}","title":string,"description":string,"timeLimit":60,"passages":[{"id":"passage-1","title":string,"text":string,"questions":[{"id":"q1","type":"multiple-choice","question":string,"options":[string,string,string,string],"correctAnswer":number,"explanation":string}]}]}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate the full original reading test now. Theme: ${opts.topic}.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The model returned invalid JSON — please try generating again.");
  }

  // Throws a descriptive error if the model's output doesn't match the shape.
  const test = readingTestSchema.parse(parsed);
  return { ...test, id };
}



/**
 * Generate a COMPLETE, fully ORIGINAL IELTS-style Listening test.
 * The model invents brand-new transcripts and questions and must never copy
 * real, published or Cambridge exam material. Validated against the schema.
 * Audio is produced client-side from the transcript (text-to-speech).
 */
export async function generateListeningTest(opts: {
  topic: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  sectionCount?: number;
  questionsPerSection?: number;
  id?: string;
}): Promise<import("@/lib/test-schema").GeneratedListeningTest> {
  const { listeningTestSchema } = await import("@/lib/test-schema");
  if (!hasOpenAI()) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY to generate tests.");
  }

  const sectionCount = Math.min(4, Math.max(1, opts.sectionCount ?? 2));
  const qps = Math.min(8, Math.max(3, opts.questionsPerSection ?? 5));
  const difficulty = opts.difficulty ?? "Medium";
  const id = opts.id || `gen-${Date.now()}`;
  const client = getOpenAIClient();

  const systemPrompt = `You are an expert IELTS item writer creating ORIGINAL listening practice for a language school.
STRICT RULE: Never copy, translate, paraphrase or adapt any real, published or Cambridge IELTS transcript or question. Everything must be brand-new writing invented by you.

Create an IELTS Listening test on the theme "${opts.topic}", difficulty "${difficulty}":
- ${sectionCount} section(s). Each section is a natural spoken passage (a conversation, announcement, or short talk), 120-220 words, written as plain spoken text suitable for text-to-speech (no speaker labels, no stage directions).
- Each section: exactly ${qps} multiple-choice questions with 4 "options" each and "answer" = the 0-based index (number) of the correct option.
- Questions must be answerable ONLY from that section's transcript.

Return ONLY JSON matching exactly:
{"id":"${id}","title":string,"difficulty":"${difficulty}","description":string,"sections":[{"title":"Section 1 — ...","transcript":string,"questions":[{"question":string,"options":[string,string,string,string],"answer":number}]}]}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate the full original listening test now. Theme: ${opts.topic}.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The model returned invalid JSON — please try generating again.");
  }

  const test = listeningTestSchema.parse(parsed);
  return { ...test, id };
}



/**
 * Generate a COMPLETE, ORIGINAL IELTS Writing Task 2 prompt with a model answer.
 * Never copies real/published exam prompts. Validated against the schema.
 */
export async function generateWritingPrompt(opts: {
  topic: string;
  essayType?: string;
  id?: string;
}): Promise<import("@/lib/test-schema").GeneratedWritingPrompt> {
  const { writingPromptSchema } = await import("@/lib/test-schema");
  if (!hasOpenAI()) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY to generate content.");
  }

  const id = opts.id || `gen-${Date.now()}`;
  const essayType = opts.essayType || "Opinion (agree/disagree)";
  const client = getOpenAIClient();

  const systemPrompt = `You are an expert IELTS Writing tutor creating ORIGINAL Task 2 practice for a language school.
STRICT RULE: Never copy, translate or adapt any real, published or Cambridge IELTS prompt. Write a brand-new task yourself.

Create ONE IELTS Academic Writing Task 2 essay task on the theme "${opts.topic}", style "${essayType}":
- "prompt": a realistic Task 2 question — a statement followed by the instruction (e.g. "To what extent do you agree or disagree?"). 2-4 sentences.
- "type": a short label such as "Opinion Essay", "Discussion Essay", or "Problem & Solution".
- "sampleAnswer": an original band 7.5-8 model essay, 260-300 words, four clear paragraphs.
- "usefulPhrases": 5-7 useful academic phrases/collocations relevant to this topic.
- "strategyEn": a 2-3 sentence strategy tip in English.
- "strategyUz": the same tip translated into Uzbek.

Return ONLY JSON:
{"id":"${id}","title":string,"prompt":string,"type":string,"sampleAnswer":string,"usefulPhrases":[string],"strategyEn":string,"strategyUz":string}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate the original Task 2 essay task now. Theme: ${opts.topic}.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The model returned invalid JSON — please try generating again.");
  }

  const promptData = writingPromptSchema.parse(parsed);
  return { ...promptData, id };
}




/**
 * Generate a COMPLETE, fully ORIGINAL IELTS Speaking practice set: one Part 1
 * topic with sample answers, one Part 2 cue card with a model long-turn, and a
 * few Part 3 discussion questions with band-8 model answers. The model must
 * never copy real, published or Cambridge exam material. Validated against the
 * schema. Uzbek strategy tips (tipUz) match the built-in content style.
 */
export async function generateSpeakingTest(opts: {
  topic: string;
  part3Count?: number;
  id?: string;
}): Promise<import("@/lib/test-schema").GeneratedSpeakingTest> {
  const { speakingTestSchema } = await import("@/lib/test-schema");
  if (!hasOpenAI()) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY to generate content.");
  }

  const part3Count = Math.min(4, Math.max(1, opts.part3Count ?? 3));
  const id = opts.id || `gen-${Date.now()}`;
  const client = getOpenAIClient();

  const systemPrompt = `You are an expert IELTS Speaking examiner creating ORIGINAL practice for a language school.
STRICT RULE: Never copy, translate or adapt any real, published or Cambridge IELTS question or answer. Everything must be brand-new writing invented by you.

Create ONE complete IELTS Speaking practice set on the theme "${opts.topic}":
- "part1": a Part 1 topic. Provide a short "name" (2-4 words), one relevant emoji as "emoji", and 5 "questions". Each question has "q" (a natural Part 1 question), "sample" (a band-7 answer of 2-4 sentences), and optional "phrases" (2-3 useful expressions).
- "part2": a Part 2 cue card. "topic" starts with "Describe...", "points" is the 4 "You should say" bullet points, "sample" is an original band-7 long-turn answer of 180-260 words (you may use \\n\\n between paragraphs), "usefulPhrases" is 5-6 expressions, and "tipUz" is a 1-2 sentence strategy tip written in Uzbek.
- "part3": ${part3Count} Part 3 discussion question(s) linked to the theme. Each has "theme" (1-2 words), "question", "sample" (an original band-8 answer of 4-6 sentences, \\n\\n allowed), "usefulPhrases" (4-5 expressions) and "tipUz" (a short strategy tip in Uzbek).

Return ONLY JSON matching exactly:
{"id":"${id}","title":string,"topic":"${opts.topic}","part1":{"emoji":string,"name":string,"questions":[{"q":string,"sample":string,"phrases":[string]}]},"part2":{"topic":string,"points":[string],"sample":string,"usefulPhrases":[string],"tipUz":string},"part3":[{"theme":string,"question":string,"sample":string,"usefulPhrases":[string],"tipUz":string}]}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate the full original speaking set now. Theme: ${opts.topic}.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The model returned invalid JSON — please try generating again.");
  }

  const test = speakingTestSchema.parse(parsed);
  return { ...test, id };
}




/**
 * Generate a COMPLETE, ORIGINAL IELTS Academic Writing Task 1 task with
 * STRUCTURED chart data (bar / line / pie) that renders as an SVG via the
 * Task1Chart component — no images required, so it is fully copyright-safe and
 * scalable. Never copies real/published exam material. Validated (including
 * series/label length consistency) against writingTask1Schema.
 */
export async function generateWritingTask1(opts: {
  topic: string;
  chartType?: "bar" | "line" | "pie" | "auto";
  id?: string;
}): Promise<import("@/lib/test-schema").GeneratedWritingTask1> {
  const { writingTask1Schema } = await import("@/lib/test-schema");
  if (!hasOpenAI()) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY to generate content.");
  }

  const id = opts.id || `gen-${Date.now()}`;
  const chartType = opts.chartType && opts.chartType !== "auto" ? opts.chartType : null;
  const client = getOpenAIClient();

  const chartInstruction = chartType
    ? `Use a "${chartType}" chart.`
    : `Choose the most suitable single chart kind ("bar", "line" or "pie") for the data.`;

  const systemPrompt = `You are an expert IELTS Writing tutor creating ORIGINAL Academic Task 1 practice for a language school.
STRICT RULE: Never copy, translate or adapt any real, published or Cambridge IELTS task. Invent brand-new, realistic data yourself.

Create ONE IELTS Academic Writing Task 1 task on the theme "${opts.topic}". ${chartInstruction}

The "chart" field is an array with exactly ONE chart object. Its shape depends on the kind:
- bar:  {"kind":"bar","unit":string,"groups":[string,...],"series":[{"name":string,"values":[number,...]}]}  — every series MUST have exactly one value per group.
- line: {"kind":"line","unit":string,"xLabels":[string,...],"series":[{"name":string,"values":[number,...]}]} — every series MUST have exactly one value per xLabel.
- pie:  {"kind":"pie","unit":string,"title":string,"slices":[{"label":string,"value":number},...]}
Rules for the data: use 2-4 groups/xLabels (or 3-6 pie slices) and 1-3 series with realistic whole numbers.

Also provide:
- "prompt": the Task 1 instruction paraphrasing what the visual shows, followed by "Summarise the information by selecting and reporting the main features, and make comparisons where relevant." and "Write at least 150 words." Do NOT restate every number in the prompt.
- "type": a short label such as "Bar Chart", "Line Graph" or "Pie Chart".
- "sampleAnswer": an original band 7.5-8 model answer, 170-210 words, with an overview paragraph plus detail paragraphs that quote the ACTUAL numbers from your chart.
- "usefulPhrases": 5-7 useful Task 1 phrases (trends, comparisons, approximations).
- "strategyEn": a 2-3 sentence strategy tip in English.
- "strategyUz": the same tip translated into Uzbek.

Return ONLY JSON:
{"id":"${id}","title":string,"prompt":string,"type":string,"chart":[<one chart object>],"sampleAnswer":string,"usefulPhrases":[string],"strategyEn":string,"strategyUz":string}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate the original Task 1 task now. Theme: ${opts.topic}.` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from OpenAI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The model returned invalid JSON — please try generating again.");
  }

  const task = writingTask1Schema.parse(parsed);
  return { ...task, id };
}



// ============================================================
// Essay X-Ray (#) — inline, band-focused essay diagnosis
// GPT-4o when a key is present; graceful heuristic fallback otherwise.
// ============================================================
export interface EssayXrayResult {
  issues: WritingIssue[]; // each .text is an exact substring for inline highlighting
  summary: string;        // short paragraph on the biggest band-limiting problems
  topFixes: string[];     // 3-5 highest-impact fixes
}

export async function analyzeEssayXray(essay: string, prompt?: string): Promise<EssayXrayResult> {
  const text = (essay || "").trim();
  if (!text) return { issues: [], summary: "Paste an essay to X-ray it.", topFixes: [] };

  // Offline / no-key fallback: reuse the safe heuristic scanner.
  if (!hasOpenAI()) {
    const issues = analyzeWritingIssues(text);
    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      issues,
      summary:
        `Quick offline scan of ${words} words found ${issues.length} thing${issues.length === 1 ? "" : "s"} to check. ` +
        `Connect an OpenAI key for a full examiner-level, band-focused X-ray.`,
      topFixes: issues.slice(0, 3).map((i) => i.suggestion),
    };
  }

  const systemPrompt = `You are an expert IELTS Writing examiner performing an "X-ray" of a student's essay.
Find the specific things that are holding the band score back and the things done well.

Return ONLY JSON:
{
  "issues": [{ "text": string, "type": "grammar" | "vocabulary" | "spelling" | "cohesion" | "punctuation" | "style" | "good", "suggestion": string }],
  "summary": string,
  "topFixes": [string]
}

Rules:
- Provide 8-16 "issues". For EACH, "text" MUST be an EXACT substring copied verbatim from the essay (a word or short phrase, at most ~8 words) so it can be located and highlighted.
- Use type "good" for 2-3 phrases the student used particularly well.
- Each "suggestion" is ONE short, concrete sentence (how to fix, or why it's good).
- "summary": one short paragraph naming the biggest band-limiting problems.
- "topFixes": 3-5 highest-impact fixes as short imperatives.
${prompt ? `Task prompt: ${prompt}` : ""}

Essay:
${text}`;

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("No response from OpenAI");
    const parsed = JSON.parse(raw) as Partial<EssayXrayResult>;
    return {
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.filter((i): i is WritingIssue => !!i && typeof i.text === "string" && i.text.trim().length > 0)
        : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      topFixes: Array.isArray(parsed.topFixes) ? parsed.topFixes.filter((f) => typeof f === "string") : [],
    };
  } catch (error) {
    // Never hard-fail: fall back to the heuristic scan.
    console.error("Essay X-Ray error:", error);
    const issues = analyzeWritingIssues(text);
    return {
      issues,
      summary: "The AI analysis is unavailable right now — showing a quick automatic scan instead.",
      topFixes: issues.slice(0, 3).map((i) => i.suggestion),
    };
  }
}



// ============================================================
// AI Roleplay Scenarios (#) — immersive in-character speaking practice
// GPT-4o when a key is present; a friendly offline fallback otherwise.
// ============================================================
const ROLEPLAY_SCENARIOS: Record<string, { role: string; setting: string }> = {
  airport: { role: "a friendly airline check-in agent", setting: "an airport check-in desk before a flight" },
  interview: { role: "a professional but warm job interviewer", setting: "a job interview for a role the student wants" },
  restaurant: { role: "a polite waiter at a restaurant", setting: "ordering a meal at a restaurant" },
  hotel: { role: "a hotel receptionist", setting: "checking in at a hotel reception" },
  doctor: { role: "a caring doctor at a clinic", setting: "a medical appointment where the student describes symptoms" },
  shopping: { role: "a helpful shop assistant in a clothing store", setting: "shopping for clothes in a store" },
};

export function roleplayScenarioIds(): string[] {
  return Object.keys(ROLEPLAY_SCENARIOS);
}

function offlineRoleplayReply(): string {
  const followups = [
    "That's great — could you tell me a little more?",
    "I see. And what would you prefer?",
    "Understood. Is there anything else I can help you with?",
    "Sounds good. Could you explain that in a bit more detail?",
  ];
  return followups[Math.floor(Math.random() * followups.length)];
}

export async function aiRoleplayReply(
  scenarioId: string,
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const scen = ROLEPLAY_SCENARIOS[scenarioId] ?? ROLEPLAY_SCENARIOS.restaurant;

  if (!hasOpenAI()) return offlineRoleplayReply();

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are ${scen.role}, role-playing a real-life English conversation with an IELTS / English learner. The scene: ${scen.setting}. Stay fully in character and keep the conversation moving. Rules:
- Speak natural, clear English suitable for an intermediate learner. Keep each reply to 1-3 sentences and ALWAYS end with a question or prompt so the learner has to respond.
- Never break character or mention that you are an AI.
- If the learner makes a significant English mistake, AFTER your in-character reply add a new line beginning exactly with "TIP:" containing one short, friendly correction. If there is no notable mistake, do not add a TIP line.`,
        },
        ...history,
        { role: "user", content: message },
      ],
      temperature: 0.8,
      max_tokens: 250,
    });
    return completion.choices[0]?.message?.content || "Sorry, could you say that again?";
  } catch (error) {
    console.error("Roleplay error:", error);
    return offlineRoleplayReply();
  }
}



// ============================================================
// Daily AI Podcast (#) — a short, personalised spoken "episode"
// GPT-4o script when a key is present; templated script otherwise.
// Audio is produced client-side via the browser SpeechSynthesis API.
// ============================================================
export interface DailyBriefing {
  title: string;
  script: string;
  bullets: string[];
}

const BRIEFING_TIPS: Record<string, { tip: string; example: string; challenge: string }> = {
  Writing: {
    tip: "In Writing, examiners reward clear structure over fancy words — give every paragraph one main idea and support it.",
    example: "instead of listing three points in one sentence, give each its own sentence with a reason.",
    challenge: "write one body paragraph with a topic sentence, an explanation and a specific example.",
  },
  Reading: {
    tip: "In Reading, don't read every word — skim for the main idea first, then scan for the keyword the question is really testing.",
    example: "if a question mentions 'benefits', hunt for synonyms like 'advantages' or 'positive effects'.",
    challenge: "do one passage and, for each answer, underline the exact words that prove it.",
  },
  Listening: {
    tip: "In Listening, read the questions before the audio and predict what kind of answer you need — a number, a name, a place.",
    example: "if a gap follows 'the meeting is on', you're listening for a day or a time.",
    challenge: "do one section and note every answer's spelling carefully.",
  },
  Speaking: {
    tip: "In Speaking, never give one-word answers — extend every reply with a reason and an example.",
    example: "'Do you like coffee?' becomes 'Yes, especially in the morning, because it helps me focus before class.'",
    challenge: "record a two-minute answer about your week and count how many times you added a reason.",
  },
  General: {
    tip: "Consistency beats intensity — thirty focused minutes today will do more than a three-hour cram on Sunday.",
    example: "pick one weak skill and give it the first slot of your study time while your mind is fresh.",
    challenge: "complete one short activity in your weakest skill before you do anything easier.",
  },
};

function offlineDailyBriefing(opts: {
  studentName?: string;
  focusArea: string;
  recentBand?: number;
  dateLabel: string;
}): DailyBriefing {
  const key = BRIEFING_TIPS[opts.focusArea] ? opts.focusArea : "General";
  const t = BRIEFING_TIPS[key];
  const hi = opts.studentName ? `Hi ${opts.studentName}` : "Hi there";
  const bandLine = opts.recentBand ? ` You're around band ${opts.recentBand} here, and small tweaks can push that up.` : "";
  const script =
    `${hi}, and welcome to Averna Daily for ${opts.dateLabel}. ` +
    `Today we're focusing on ${opts.focusArea}.${bandLine} ` +
    `${t.tip} For example, ${t.example} ` +
    `Here's your mini-challenge for today: ${t.challenge} ` +
    `That's it — small steps every day add up to a big band jump. You've got this. See you tomorrow!`;
  return {
    title: `Averna Daily — ${opts.focusArea}`,
    script,
    bullets: [t.tip, `Example: ${t.example}`, `Today: ${t.challenge}`],
  };
}

export async function generateDailyBriefing(opts: {
  studentName?: string;
  focusArea: string;
  recentBand?: number;
  dateLabel: string;
}): Promise<DailyBriefing> {
  if (!hasOpenAI()) return offlineDailyBriefing(opts);

  const systemPrompt = `You are the host of "Averna Daily", a short, upbeat ~90-second English-learning podcast for an IELTS student.
Create today's episode focused on "${opts.focusArea}"${opts.recentBand ? ` (their recent band is about ${opts.recentBand})` : ""}.

Return ONLY JSON:
{
  "title": string,
  "script": string,
  "bullets": [string, string, string]
}

Rules:
- "title": catchy, at most 8 words.
- "script": 150-220 words of flowing SPOKEN text (it will be read aloud by text-to-speech, so no headings, lists or markdown). Greet the listener${opts.studentName ? ` by name ("${opts.studentName}")` : ""}, mention today is ${opts.dateLabel}, give ONE focused, practical tip for ${opts.focusArea}, one quick concrete example, one small challenge for today, and a warm, motivating sign-off.
- "bullets": exactly 3 short written takeaways.`;

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("No response from OpenAI");
    const parsed = JSON.parse(raw) as Partial<DailyBriefing>;
    if (!parsed.script || typeof parsed.script !== "string") throw new Error("Invalid briefing");
    return {
      title: typeof parsed.title === "string" ? parsed.title : `Averna Daily — ${opts.focusArea}`,
      script: parsed.script,
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.filter((b) => typeof b === "string").slice(0, 3) : [],
    };
  } catch (error) {
    console.error("Daily briefing error:", error);
    return offlineDailyBriefing(opts);
  }
}



// ============================================================
// Admin Mission Control — AI Executive Briefing (Uzbek)
// GPT-4o narrative when a key is present; templated Uzbek fallback otherwise.
// ============================================================
export async function generateAdminBriefing(ctx: {
  firstName?: string;
  bullets: string[];
  priorities: string[];
  risks: string[];
}): Promise<string> {
  const { firstName, bullets, priorities, risks } = ctx;
  const hi = firstName ? `Assalomu alaykum, ${firstName}.` : "Assalomu alaykum.";

  // Templated Uzbek fallback (also used when there is no key or on error).
  const fallback = () => {
    const parts: string[] = [hi];
    if (bullets.length) parts.push(`Bugungi holat: ${bullets.join(" ")}`);
    if (priorities.length) parts.push(`Bugungi ustuvor vazifalar: ${priorities.join(" ")}`);
    if (risks.length) parts.push(`Eʼtibor bering: ${risks.join(" ")}`);
    parts.push("Kichik, aniq qadamlar bugun eng katta taʼsir beradi.");
    return parts.join(" ");
  };

  if (!hasOpenAI()) return fallback();

  const systemPrompt = `Siz Averna Learning Centre platformasining AI boshqaruv yordamchisisiz.
Administrator uchun QISQA, aniq va professional kunlik xulosa yozing.
QATTIY QOIDALAR:
- Faqat OʻZBEK tilida (lotin yozuvi), toʻgʻri imlo bilan (oʻ, gʻ, ʼ).
- 3-5 jumla, xotirjam va ishonchli ohangda.
- Berilgan maʼlumotlardan tashqari raqam yoki dalil OʻYLAB TOPMANG.
- Salomlashish bilan boshlang, keyin eng muhim holat, ustuvorlik va xavf haqida ayting, ijobiy yakun bilan tugating.
Faqat matnni qaytaring (JSON emas).

Maʼlumot:
Salom: ${hi}
Bugungi koʻrsatkichlar: ${bullets.join(" ")}
Ustuvor vazifalar: ${priorities.join(" ") || "yoʻq"}
Xavflar: ${risks.join(" ") || "yoʻq"}`;

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0.5,
      max_tokens: 320,
    });
    return completion.choices[0]?.message?.content?.trim() || fallback();
  } catch (error) {
    console.error("Admin briefing error:", error);
    return fallback();
  }
}



// ============================================================
// Teacher — AI Lesson Builder (F2)
// GPT-4o structured lesson plan when a key is present; a solid templated
// skeleton otherwise. Everything is a starting draft the teacher adapts.
// ============================================================
export interface LessonPlan {
  topic: string;
  level: string;
  objectives: string[];
  warmup: string;
  presentation: string[];
  examples: string[];
  exercises: string[];
  speaking: string[];
  writingPrompt: string;
  vocabulary: string[];
  homework: string;
  quiz: { q: string; a: string }[];
  differentiation: { stronger: string; weaker: string };
}

function templateLessonPlan(topic: string, level: string): LessonPlan {
  const t = topic.trim() || "Today's topic";
  return {
    topic: t,
    level,
    objectives: [
      `Understand the form and use of ${t}`,
      `Recognise ${t} in reading and listening texts`,
      `Produce ${t} accurately in speaking and writing`,
    ],
    warmup: `Elicit what students already know about ${t}. Put 2 example sentences on the board — one correct, one with a typical mistake — and ask students to spot the difference (5 min).`,
    presentation: [
      `Introduce the rule/form of ${t} with a clear board diagram.`,
      `Contrast it with a related structure students often confuse it with.`,
      `Concept-check with 3 quick questions before any production.`,
    ],
    examples: [
      `A clear affirmative example of ${t}.`,
      `A negative/question form example.`,
      `A common error and its correction (highlight why).`,
    ],
    exercises: [
      `Gap-fill: 8 sentences targeting ${t} (controlled practice).`,
      `Error-correction: 6 sentences with typical mistakes.`,
      `Transformation: rewrite 5 sentences using ${t}.`,
    ],
    speaking: [
      `Pair discussion using ${t} at least 3 times each.`,
      `Mini role-play where ${t} naturally appears.`,
      `1-minute individual talk applying ${t}.`,
    ],
    writingPrompt: `Write a short paragraph (60–80 words) that uses ${t} at least three times, then underline each use.`,
    vocabulary: ["accurate", "structure", "context", "appropriate", "meaning", "form", "usage", "example"],
    homework: `Write 8 original sentences using ${t}, plus complete the workbook exercise. Bring one question about ${t} to the next lesson.`,
    quiz: [
      { q: `When do we use ${t}?`, a: "Students state the rule in their own words." },
      { q: `Correct the mistake in a sentence with ${t}.`, a: "Students identify and fix the error." },
      { q: `Produce one original sentence with ${t}.`, a: "Any accurate, meaningful sentence." },
    ],
    differentiation: {
      stronger: `Add nuance/exceptions of ${t} and a Band 7+ writing extension.`,
      weaker: `Provide a sentence frame and more guided controlled practice before free production.`,
    },
  };
}

export async function generateLessonPlan(topic: string, level = "B1–B2"): Promise<LessonPlan> {
  const t = (topic || "").trim();
  if (!t) return templateLessonPlan("Today's topic", level);
  if (!hasOpenAI()) return templateLessonPlan(t, level);

  const systemPrompt = `You are an experienced IELTS/English lesson planner. Build a complete, practical OFFLINE lesson plan for the topic "${t}" at CEFR level ${level}.
Return ONLY JSON matching exactly:
{
  "topic": string,
  "level": string,
  "objectives": [string],
  "warmup": string,
  "presentation": [string],
  "examples": [string],
  "exercises": [string],
  "speaking": [string],
  "writingPrompt": string,
  "vocabulary": [string],
  "homework": string,
  "quiz": [{ "q": string, "a": string }],
  "differentiation": { "stronger": string, "weaker": string }
}
Keep it concrete and classroom-ready (a real teacher could run it as-is). 3–5 items per list. No markdown.`;

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("No response");
    const p = JSON.parse(raw) as Partial<LessonPlan>;
    const fallback = templateLessonPlan(t, level);
    const arr = (v: unknown, f: string[]) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : f);
    return {
      topic: typeof p.topic === "string" ? p.topic : t,
      level: typeof p.level === "string" ? p.level : level,
      objectives: arr(p.objectives, fallback.objectives),
      warmup: typeof p.warmup === "string" ? p.warmup : fallback.warmup,
      presentation: arr(p.presentation, fallback.presentation),
      examples: arr(p.examples, fallback.examples),
      exercises: arr(p.exercises, fallback.exercises),
      speaking: arr(p.speaking, fallback.speaking),
      writingPrompt: typeof p.writingPrompt === "string" ? p.writingPrompt : fallback.writingPrompt,
      vocabulary: arr(p.vocabulary, fallback.vocabulary),
      homework: typeof p.homework === "string" ? p.homework : fallback.homework,
      quiz: Array.isArray(p.quiz) ? p.quiz.filter((x) => x && typeof x.q === "string" && typeof x.a === "string") : fallback.quiz,
      differentiation:
        p.differentiation && typeof p.differentiation.stronger === "string" && typeof p.differentiation.weaker === "string"
          ? p.differentiation
          : fallback.differentiation,
    };
  } catch (error) {
    console.error("Lesson builder error:", error);
    return templateLessonPlan(t, level);
  }
}



// ============================================================
// Teacher — F4 Lesson Reflection · F9 Future Class Simulator · F10 Teacher Twin
// GPT-4o with graceful fallbacks. All outputs are drafts the teacher controls.
// ============================================================
export interface LessonReflection {
  summary: string[];
  nextSuggestions: string[];
  reviewActivities: string[];
}

export async function generateLessonReflection(input: {
  topic: string;
  notes?: string;
  weakArea?: string | null;
  groupName?: string;
}): Promise<LessonReflection> {
  const { topic, notes, weakArea, groupName } = input;
  const fallback = (): LessonReflection => ({
    summary: [
      `Covered ${topic}${groupName ? ` with ${groupName}` : ""}.`,
      notes ? `Your notes: ${notes}` : `No lesson notes were recorded — add a few next time for sharper reflections.`,
      weakArea ? `This group's weakest skill is ${weakArea} — watch for it bleeding into ${topic}.` : `Watch for the usual mistakes with ${topic}.`,
    ],
    nextSuggestions: [
      `Start the next lesson with a 5-minute recap of ${topic}.`,
      weakArea ? `Weave a short ${weakArea} task into the warm-up.` : `Add a quick diagnostic to check retention of ${topic}.`,
      `Pair stronger and weaker students for the first practice activity.`,
    ],
    reviewActivities: [
      `Error-correction sprint on ${topic} (6 sentences).`,
      `2-minute spoken recap: each student uses ${topic} once.`,
      `Exit ticket: one sentence applying ${topic}.`,
    ],
  });

  if (!hasOpenAI()) return fallback();

  const sys = `You are an experienced academic coordinator writing a concise post-lesson reflection for a teacher after an OFFLINE IELTS lesson.
Topic: "${topic}". ${groupName ? `Group: ${groupName}. ` : ""}${weakArea ? `This group's weakest skill: ${weakArea}. ` : ""}${notes ? `Teacher notes: ${notes}` : ""}
Return ONLY JSON: { "summary": [string], "nextSuggestions": [string], "reviewActivities": [string] }. 3 items per list, concrete and practical, grounded in the notes when given. No markdown.`;

  try {
    const client = getOpenAIClient();
    const c = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: sys }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });
    const raw = c.choices[0]?.message?.content;
    if (!raw) throw new Error("empty");
    const p = JSON.parse(raw) as Partial<LessonReflection>;
    const f = fallback();
    const arr = (v: unknown, d: string[]) => (Array.isArray(v) && v.length ? v.filter((x) => typeof x === "string") : d);
    return {
      summary: arr(p.summary, f.summary),
      nextSuggestions: arr(p.nextSuggestions, f.nextSuggestions),
      reviewActivities: arr(p.reviewActivities, f.reviewActivities),
    };
  } catch (e) {
    console.error("Lesson reflection error:", e);
    return fallback();
  }
}

export interface ClassSimulation {
  difficultConcepts: string[];
  likelyQuestions: string[];
  commonMistakes: string[];
  examples: string[];
  exercises: string[];
  timing: string;
  backups: string[];
}

export async function simulateClass(input: {
  topic: string;
  level?: string | null;
  size?: number;
  avgBand?: number | null;
  weakArea?: string | null;
}): Promise<ClassSimulation> {
  const { topic, level, size, avgBand, weakArea } = input;
  const fallback = (): ClassSimulation => ({
    difficultConcepts: [`The trickiest part of ${topic} for mixed-ability groups`, `Where ${topic} overlaps with a commonly-confused structure`],
    likelyQuestions: [`"When exactly do we use ${topic}?"`, `"Is this sentence with ${topic} correct?"`, `"What's the difference between this and…?"`],
    commonMistakes: [`Overusing ${topic} where it isn't needed`, `Form errors under time pressure`, weakArea ? `${weakArea} weaknesses showing up inside ${topic}` : `Mixing up similar structures`],
    examples: [`One clear model sentence of ${topic}`, `A before/after correction`, `A real IELTS-style example`],
    exercises: [`Controlled gap-fill (8 items)`, `Error correction (6 items)`, `Free production task`],
    timing: `Warm-up 5m · Presentation 10m · Controlled practice 15m · Freer practice 15m · Wrap-up 5m`,
    backups: [`Extension task for fast finishers on ${topic}`, `A quick speaking round if time remains`],
  });

  if (!hasOpenAI()) return fallback();

  const sys = `You are an academic coordinator predicting how an OFFLINE IELTS class will go BEFORE the lesson, so the teacher can prepare.
Topic: "${topic}". ${level ? `Level: ${level}. ` : ""}${size ? `Class size: ${size}. ` : ""}${avgBand != null ? `Class average band: ~${avgBand}. ` : ""}${weakArea ? `Class's weakest skill: ${weakArea}. ` : ""}
Return ONLY JSON: { "difficultConcepts": [string], "likelyQuestions": [string], "commonMistakes": [string], "examples": [string], "exercises": [string], "timing": string, "backups": [string] }. 2-4 items per list, concrete. No markdown.`;

  try {
    const client = getOpenAIClient();
    const c = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: sys }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });
    const raw = c.choices[0]?.message?.content;
    if (!raw) throw new Error("empty");
    const p = JSON.parse(raw) as Partial<ClassSimulation>;
    const f = fallback();
    const arr = (v: unknown, d: string[]) => (Array.isArray(v) && v.length ? v.filter((x) => typeof x === "string") : d);
    return {
      difficultConcepts: arr(p.difficultConcepts, f.difficultConcepts),
      likelyQuestions: arr(p.likelyQuestions, f.likelyQuestions),
      commonMistakes: arr(p.commonMistakes, f.commonMistakes),
      examples: arr(p.examples, f.examples),
      exercises: arr(p.exercises, f.exercises),
      timing: typeof p.timing === "string" ? p.timing : f.timing,
      backups: arr(p.backups, f.backups),
    };
  } catch (e) {
    console.error("Class simulation error:", e);
    return fallback();
  }
}

export async function draftTeacherFeedback(input: { context: string; samples: string[] }): Promise<string> {
  const { context, samples } = input;
  const fallback = () =>
    `Great effort on this. You clearly understood the task, and there are real strengths to build on. ` +
    `To push higher: tighten your weaker areas, vary your sentence structures, and proofread for small slips. ` +
    `Keep this up — you're moving in the right direction.` +
    (context ? `\n\n(Context: ${context})` : "");

  if (!hasOpenAI() || samples.length === 0) return fallback();

  const sys = `You are the "AI Twin" of a specific teacher. Learn their feedback VOICE from the examples below and draft new feedback in the SAME tone, length and structure. Never invent facts about the student.
Teacher's past feedback examples:
${samples.map((s, i) => `--- Example ${i + 1} ---\n${s}`).join("\n")}

Now draft feedback for this situation, matching the teacher's style: ${context || "a student's essay"}.
Return ONLY the feedback text (no preamble, no markdown).`;

  try {
    const client = getOpenAIClient();
    const c = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: sys }],
      temperature: 0.7,
      max_tokens: 320,
    });
    return c.choices[0]?.message?.content?.trim() || fallback();
  } catch (e) {
    console.error("Teacher twin error:", e);
    return fallback();
  }
}



// ============================================================
// F1 — Averna AI (platform-wide, context-aware learning companion)
// GPT-4o grounded in the student's REAL data; rule-based fallback supplied by
// the caller so it always answers something useful.
// ============================================================
export async function avernaAssistant(
  profileText: string,
  message: string,
  history: { role: "user" | "assistant"; content: string }[],
  fallback: string,
): Promise<string> {
  if (!hasOpenAI()) return fallback;
  try {
    const client = getOpenAIClient();
    const c = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            `You are Averna AI — a warm, insightful IELTS mentor who knows this student personally. ` +
            `Answer using ONLY the real data below; never invent numbers, dates or facts. ` +
            `Be concise (2–5 sentences), specific and encouraging, and always end with ONE concrete next action grounded in their data.\n\n` +
            `STUDENT DATA:\n${profileText}`,
        },
        ...history.slice(-8),
        { role: "user", content: message },
      ],
      temperature: 0.5,
      max_tokens: 320,
    });
    return c.choices[0]?.message?.content?.trim() || fallback;
  } catch (e) {
    console.error("Averna AI error:", e);
    return fallback;
  }
}
