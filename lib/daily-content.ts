import { tashkentDayOfYear } from "@/lib/utils";

export interface DailyArticleContent {
  title: string;
  body: string;
  vocabulary: { word: string; meaning: string }[];
}

// A rotating pool of short English-learning articles. One per day,
// chosen deterministically by the Tashkent day-of-year.
export const ARTICLE_POOL: DailyArticleContent[] = [
  {
    title: "Why Reading Every Day Boosts Your English",
    body:
      "Reading in English for just fifteen minutes a day can dramatically improve your vocabulary, grammar and writing. " +
      "When you read regularly, you absorb how natural sentences are built and you encounter words in context, which makes them easier to remember. " +
      "Experts recommend choosing material slightly above your current level — challenging enough to learn from, but not so hard that you give up. " +
      "News articles, short stories and even subtitles are all excellent sources. The key is consistency: a small amount every day beats a huge effort once a week.",
    vocabulary: [
      { word: "dramatically", meaning: "in a sudden and impressive way" },
      { word: "absorb", meaning: "to take in information gradually" },
      { word: "in context", meaning: "within a surrounding situation that gives meaning" },
      { word: "consistency", meaning: "doing something regularly in the same way" },
    ],
  },
  {
    title: "The Secret to Speaking Fluently",
    body:
      "Many learners believe fluency means speaking fast, but true fluency is about speaking smoothly and clearly without long pauses. " +
      "The best way to build it is simple: speak every day, even to yourself. Describe what you see, narrate your routine, or record short answers to IELTS questions. " +
      "Don't worry about perfect grammar at first — communication comes before correctness. Over time, accuracy follows fluency naturally. " +
      "Shadowing, where you repeat after a native speaker, is a powerful technique for improving rhythm and pronunciation.",
    vocabulary: [
      { word: "fluency", meaning: "the ability to speak smoothly and easily" },
      { word: "narrate", meaning: "to describe events as they happen" },
      { word: "accuracy", meaning: "being correct and without mistakes" },
      { word: "shadowing", meaning: "repeating speech immediately after hearing it" },
    ],
  },
  {
    title: "How Sleep Affects Your Learning",
    body:
      "Studying hard is important, but sleep is just as essential for learning a language. While you sleep, your brain consolidates memories, " +
      "moving new vocabulary and grammar from short-term to long-term storage. Students who sleep well after studying remember far more the next day. " +
      "Pulling an all-nighter before an exam often backfires, because tiredness reduces concentration and recall. " +
      "Aim for seven to nine hours, and try reviewing new words shortly before bed — your brain will keep working on them as you rest.",
    vocabulary: [
      { word: "consolidate", meaning: "to make something stronger or more solid" },
      { word: "recall", meaning: "the ability to remember information" },
      { word: "backfire", meaning: "to have the opposite effect to what was intended" },
      { word: "essential", meaning: "absolutely necessary" },
    ],
  },
  {
    title: "Smart Goals for IELTS Success",
    body:
      "A vague goal like 'improve my English' is hard to achieve. Successful learners set SMART goals: Specific, Measurable, Achievable, Relevant and Time-bound. " +
      "Instead of 'get better at writing', try 'write two Task 2 essays per week and review my mistakes'. This gives you a clear action and a way to track progress. " +
      "Breaking a big target, such as Band 7, into weekly steps keeps you motivated and prevents you from feeling overwhelmed. " +
      "Celebrate small wins along the way — they build the confidence that carries you to your final goal.",
    vocabulary: [
      { word: "vague", meaning: "not clearly expressed or defined" },
      { word: "measurable", meaning: "able to be measured or tracked" },
      { word: "overwhelmed", meaning: "feeling unable to cope with too much" },
      { word: "motivated", meaning: "having a strong reason to act" },
    ],
  },
  {
    title: "The Power of Learning Words in Groups",
    body:
      "Memorising single words is far less effective than learning them in natural groups called collocations. For example, instead of just 'decision', " +
      "learn 'make a decision', 'a difficult decision' and 'reach a decision'. These word partnerships are how native speakers actually use the language. " +
      "When you write or speak using strong collocations, your English sounds more natural and scores higher in exams. " +
      "Keep a vocabulary notebook organised by topic, and always write an example sentence so you remember how each word is used.",
    vocabulary: [
      { word: "collocation", meaning: "words that are often used together" },
      { word: "partnership", meaning: "a close working relationship" },
      { word: "natural", meaning: "sounding normal, not forced" },
      { word: "organise", meaning: "to arrange in a structured way" },
    ],
  },
  {
    title: "Mistakes Are Your Best Teacher",
    body:
      "Many learners fear making mistakes, but mistakes are one of the fastest ways to improve. Each error shows you exactly what to work on next. " +
      "The most successful students keep an 'error log': they write down the mistake, the correction, and a note about the rule. Reviewing this log weekly turns weaknesses into strengths. " +
      "Avoid the trap of perfectionism, which often leads to silence and slow progress. " +
      "Be brave, speak and write often, and treat every correction as a free lesson rather than a failure.",
    vocabulary: [
      { word: "error log", meaning: "a record of mistakes and corrections" },
      { word: "perfectionism", meaning: "the refusal to accept anything less than perfect" },
      { word: "weakness", meaning: "an area that needs improvement" },
      { word: "brave", meaning: "showing courage" },
    ],
  },
  {
    title: "How Technology Is Changing Language Learning",
    body:
      "Twenty years ago, learning English meant heavy textbooks and a cassette player. Today, technology has transformed the experience. " +
      "Apps deliver bite-sized lessons, speech recognition gives instant pronunciation feedback, and online platforms connect learners across the world. " +
      "Artificial intelligence can now estimate your band score and suggest exactly what to practise next. " +
      "However, technology is a tool, not a magic solution — real progress still depends on regular, focused practice and the courage to use the language.",
    vocabulary: [
      { word: "transform", meaning: "to change completely" },
      { word: "bite-sized", meaning: "small and easy to manage" },
      { word: "instant", meaning: "happening immediately" },
      { word: "focused", meaning: "concentrated on one thing" },
    ],
  },
];

export function getTodayArticle(): DailyArticleContent {
  return ARTICLE_POOL[tashkentDayOfYear() % ARTICLE_POOL.length];
}
