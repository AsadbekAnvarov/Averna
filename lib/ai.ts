import OpenAI from "openai";

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
