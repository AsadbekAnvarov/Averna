/**
 * Placement test content — original Averna material (never copied from
 * Cambridge, published books or websites).
 *
 * One form = Grammar & Vocabulary (30 items rising A1 → C1, 6 per level) +
 * one Listening part (exam-v2, 10 questions) + one short Reading passage
 * (exam-v2, 12 questions) + an optional Writing prompt.
 *
 * SERVER ONLY in practice: this file carries the answer keys. Client
 * components receive sanitised shapes (lib/placement/placement.ts).
 * Pure data with relative imports, so the offline check can compile it
 * (lib/placement/check-content.ts).
 *
 * A form that students have sat must never be edited (their results point at
 * its item numbers) — publish a new form id instead.
 */

import type { ExamListeningTest, ExamReadingTest } from "../ielts/types";
import type { GvItem, PlacementForm, PlacementWritingPrompt } from "./types";

const opts = (a: string, b: string, c: string, d: string) => [
  { key: "A", text: a },
  { key: "B", text: b },
  { key: "C", text: c },
  { key: "D", text: d },
];

// ===========================================================================
// Grammar & Vocabulary — 30 items, A1 → C1
// ===========================================================================

export const GV_ITEMS_V1: GvItem[] = [
  // ---- A1 -------------------------------------------------------------------
  {
    n: 1,
    level: "A1",
    topic: "tenses",
    text: "My sister _____ in a hospital. She is a nurse.",
    options: opts("work", "is work", "working", "works"),
    answer: "D",
    explanation: "Use the present simple for jobs and routines, and add -s after he / she / it: she works.",
  },
  {
    n: 2,
    level: "A1",
    topic: "articles",
    text: "I have _____ idea! Let's have a picnic in the park.",
    options: opts("a", "the", "an", "some"),
    answer: "C",
    explanation: "Use an before a vowel sound (an idea, an hour) and a before a consonant sound (a picnic).",
  },
  {
    n: 3,
    level: "A1",
    topic: "prepositions",
    text: "The shop opens _____ 9 o'clock in the morning.",
    options: opts("in", "at", "on", "to"),
    answer: "B",
    explanation: "Use at with clock times (at 9 o'clock), on with days (on Monday) and in with months and years (in May).",
  },
  {
    n: 4,
    level: "A1",
    topic: "modals",
    text: "My grandmother is 90, but she _____ still read without glasses.",
    options: opts("can", "cans", "is", "to can"),
    answer: "A",
    explanation: "Can is followed by the base verb, with no -s and no to: she can read.",
  },
  {
    n: 5,
    level: "A1",
    topic: "collocations",
    text: "I _____ my homework every evening after dinner.",
    options: opts("do", "make", "play", "go"),
    answer: "A",
    explanation: "We do homework (and do the housework) — we don't make homework.",
  },
  {
    n: 6,
    level: "A1",
    topic: "word-formation",
    text: "There are twenty _____ in my class.",
    options: opts("child", "childs", "childrens", "children"),
    answer: "D",
    explanation: "Child has an irregular plural: one child, two children — with no -s.",
  },
  // ---- A2 -------------------------------------------------------------------
  {
    n: 7,
    level: "A2",
    topic: "tenses",
    text: "We _____ a great film at the cinema last night.",
    options: opts("see", "are seeing", "saw", "have seen"),
    answer: "C",
    explanation: "Use the past simple for a finished action at a finished time (last night): see → saw.",
  },
  {
    n: 8,
    level: "A2",
    topic: "articles",
    text: "Look at _____ moon! It's so bright tonight.",
    options: opts("the", "a", "an", "(no article)"),
    answer: "A",
    explanation: "Use the for things there is only one of: the moon, the sun, the sky.",
  },
  {
    n: 9,
    level: "A2",
    topic: "prepositions",
    text: "My brother is very good _____ football.",
    options: opts("in", "on", "with", "at"),
    answer: "D",
    explanation: "Good at + an activity or subject: good at football, good at maths.",
  },
  {
    n: 10,
    level: "A2",
    topic: "modals",
    text: "You _____ smoke in the hospital. It isn't allowed.",
    options: opts("don't have to", "mustn't", "needn't", "wouldn't"),
    answer: "B",
    explanation: "Mustn't means something is not allowed; don't have to means it isn't necessary.",
  },
  {
    n: 11,
    level: "A2",
    topic: "word-formation",
    text: "The museum was really _____. I didn't want to leave!",
    options: opts("interest", "interesting", "interested", "interestingly"),
    answer: "B",
    explanation: "-ing adjectives describe the thing (an interesting museum); -ed adjectives describe how people feel (I was interested).",
  },
  {
    n: 12,
    level: "A2",
    topic: "collocations",
    text: "Can you _____ a photo of us, please?",
    options: opts("take", "make", "do", "put"),
    answer: "A",
    explanation: "In English we take a photo — not make or do a photo.",
  },
  // ---- B1 -------------------------------------------------------------------
  {
    n: 13,
    level: "B1",
    topic: "tenses",
    text: "I _____ in this city since I was ten.",
    options: opts("live", "am living", "lived", "have lived"),
    answer: "D",
    explanation: "Use the present perfect with since or for when a situation started in the past and continues now.",
  },
  {
    n: 14,
    level: "B1",
    topic: "conditionals",
    text: "If it _____ tomorrow, we'll have the picnic indoors.",
    options: opts("will rain", "rains", "rained", "would rain"),
    answer: "B",
    explanation: "First conditional: if + present simple, then will + verb — don't use will in the if-clause.",
  },
  {
    n: 15,
    level: "B1",
    topic: "passive",
    text: "The first bridge across the river _____ in 1874.",
    options: opts("was built", "built", "has been built", "is building"),
    answer: "A",
    explanation: "The passive is be + past participle; use the past simple passive (was built) for a finished time in the past.",
  },
  {
    n: 16,
    level: "B1",
    topic: "prepositions",
    text: "Whether we go camping depends _____ the weather.",
    options: opts("of", "from", "on", "in"),
    answer: "C",
    explanation: "The verb depend is followed by on: it depends on the weather.",
  },
  {
    n: 17,
    level: "B1",
    topic: "collocations",
    text: "It took her weeks to _____ a decision about which university to choose.",
    options: opts("do", "have", "make", "say"),
    answer: "C",
    explanation: "We make a decision (also make a mistake, make progress), but we do homework or do an exam.",
  },
  {
    n: 18,
    level: "B1",
    topic: "academic-vocabulary",
    text: "The number of students who cycle to school has _____ from 20% to 35% over the last five years.",
    options: opts("raised", "grown up", "lifted", "risen"),
    answer: "D",
    explanation: "Rise – rose – risen has no object (numbers rise); raise needs an object (raise prices).",
  },
  // ---- B2 -------------------------------------------------------------------
  {
    n: 19,
    level: "B2",
    topic: "tenses",
    text: "By the time we arrived at the station, the train _____.",
    options: opts("already leaves", "has already left", "had already left", "is already leaving"),
    answer: "C",
    explanation: "Use the past perfect (had + past participle) for an action completed before another moment in the past.",
  },
  {
    n: 20,
    level: "B2",
    topic: "conditionals",
    text: "If we had left home earlier yesterday, we _____ the flight.",
    options: opts("wouldn't miss", "hadn't missed", "didn't miss", "wouldn't have missed"),
    answer: "D",
    explanation: "Third conditional for an imaginary past: if + past perfect, then would have + past participle.",
  },
  {
    n: 21,
    level: "B2",
    topic: "passive",
    text: "I don't like _____ what to do — I prefer to make my own decisions.",
    options: opts("being told", "telling", "to tell", "be told"),
    answer: "A",
    explanation: "After like, enjoy or hate, use the -ing form; its passive is being + past participle (being told).",
  },
  {
    n: 22,
    level: "B2",
    topic: "modals",
    text: "You _____ have told me it was your birthday! I would have bought you a present.",
    options: opts("must", "should", "can", "would"),
    answer: "B",
    explanation: "Should have + past participle criticises something that didn't happen in the past (you didn't tell me).",
  },
  {
    n: 23,
    level: "B2",
    topic: "articles",
    text: "_____ unemployment has risen in many countries this year.",
    options: opts("The", "An", "A", "(no article)"),
    answer: "D",
    explanation: "Uncountable nouns used in a general sense take no article: unemployment, education, pollution.",
  },
  {
    n: 24,
    level: "B2",
    topic: "academic-vocabulary",
    text: "The study's findings _____ that regular exercise can improve memory.",
    options: opts("advise", "suggest", "recommend", "persuade"),
    answer: "B",
    explanation: "In academic writing, findings suggest (or indicate) that something is true; advise and recommend tell people what to do.",
  },
  // ---- C1 -------------------------------------------------------------------
  {
    n: 25,
    level: "C1",
    topic: "tenses",
    text: "By the end of this month, I _____ at this company for exactly ten years.",
    options: opts("will work", "am working", "will have been working", "have worked"),
    answer: "C",
    explanation: "The future perfect (continuous) looks back from a point in the future: by then, I will have been working here for ten years.",
  },
  {
    n: 26,
    level: "C1",
    topic: "conditionals",
    text: "_____ you need any further information, please do not hesitate to contact me.",
    options: opts("Should", "Would", "Were", "Had"),
    answer: "A",
    explanation: "In formal English, should + subject can replace if: “Should you need help” means “If you need help”.",
  },
  {
    n: 27,
    level: "C1",
    topic: "passive",
    text: "The painting _____ to be worth over two million dollars.",
    options: opts("believes", "is believed", "is believing", "has believed"),
    answer: "B",
    explanation: "The reporting passive (is believed / said / thought + to-infinitive) is common in formal writing.",
  },
  {
    n: 28,
    level: "C1",
    topic: "modals",
    text: "He _____ have been at the meeting — I was there the whole time and didn't see him.",
    options: opts("hadn't", "can't", "shouldn't", "needn't"),
    answer: "B",
    explanation: "Can't have + past participle shows you are sure something did not happen in the past.",
  },
  {
    n: 29,
    level: "C1",
    topic: "word-formation",
    text: "The results were _____ because the sample was far too small.",
    options: opts("reliable", "reliably", "unreliable", "unreliability"),
    answer: "C",
    explanation: "The sentence needs an adjective with a negative meaning: un- + reliable = unreliable (not to be trusted).",
  },
  {
    n: 30,
    level: "C1",
    topic: "academic-vocabulary",
    text: "The effects of the new law are difficult to _____ because so many other factors are involved.",
    options: opts("quantify", "qualify", "quantity", "quality"),
    answer: "A",
    explanation: "To quantify something is to measure it as a number; quantity and quality are nouns, and qualify means something else.",
  },
];

// ===========================================================================
// Listening — one everyday conversation, 10 questions
// ===========================================================================

export const PLACEMENT_LISTENING_V1: ExamListeningTest = {
  format: "exam-v2",
  skill: "LISTENING",
  id: "placement-listening-1",
  title: "Placement test · Listening",
  description: "A phone call to a bus company's lost property office: form completion and multiple choice. 1 part, 10 questions.",
  difficulty: "Easy",
  topics: ["transport", "everyday life"],
  source: "averna",
  parts: [
    {
      id: "placement-listening-1-part-1",
      title: "Part 1",
      context: "You will hear a woman telephoning a bus company's lost property office about a bag she left on a bus.",
      speakers: [
        { name: "Daniel", gender: "male", accent: "british" },
        { name: "Harriet", gender: "female", accent: "australian" },
      ],
      script: [
        { speaker: "Narrator", text: "Now listen carefully and answer questions 1 to 6." },
        { speaker: "Daniel", text: "Good morning, City Buses lost property office. Daniel speaking. How can I help you?" },
        {
          speaker: "Harriet",
          text: "Oh, hello. I think I left my bag on one of your buses this morning, and I was hoping somebody might have handed it in.",
        },
        {
          speaker: "Daniel",
          text: "Well, you've come to the right place. Things usually reach us within a few hours. I'll take a few details first, and then I'll check what we've got. Could I have your name, please?",
        },
        { speaker: "Harriet", text: "Yes, it's Harriet Fenwick." },
        { speaker: "Daniel", text: "And how do you spell your surname?" },
        { speaker: "Harriet", text: "F, E, N, W, I, C, K." },
        { speaker: "Daniel", text: "F, E, N, W, I, C, K. Thank you, Ms Fenwick. Which bus were you on?" },
        {
          speaker: "Harriet",
          text: "Well, I usually take the number fourteen to work, but it was late this morning, and the forty came first, so I got on that instead.",
        },
        { speaker: "Daniel", text: "The forty. That's the one that goes through the city centre. And where did you get off?" },
        { speaker: "Harriet", text: "At the stop outside the museum. It's the one just after the park." },
        { speaker: "Daniel", text: "Outside the museum. Lovely. And can you describe the bag for me?" },
        {
          speaker: "Harriet",
          text: "It's a backpack, quite a small one. It's dark green. People sometimes think it's black, but it's definitely green. Oh, and it's made of canvas, not leather, so it's quite soft.",
        },
        {
          speaker: "Daniel",
          text: "A small green canvas backpack. Is there anything on it that would help us recognise it? A name tag, perhaps?",
        },
        {
          speaker: "Harriet",
          text: "There's no name tag, I'm afraid. But there's a badge on the front pocket. It's a little yellow star. My daughter gave it to me.",
        },
        {
          speaker: "Daniel",
          text: "A yellow star. That's very useful, actually. People hand in a lot of green backpacks. And what was inside it?",
        },
        {
          speaker: "Harriet",
          text: "My purse, with my bank cards in it, and my house keys. And a library book, which is already overdue, unfortunately. Oh, and my glasses. No, wait, sorry, I'm wearing my glasses. So it's just the purse, the keys and the book.",
        },
        { speaker: "Daniel", text: "Purse, keys and a library book. Right.", pauseAfter: 2 },
        {
          speaker: "Narrator",
          text: "Before you hear the rest of the conversation, you have some time to look at questions 7 to 10.",
          pauseAfter: 20,
        },
        { speaker: "Narrator", text: "Now listen and answer questions 7 to 10." },
        {
          speaker: "Daniel",
          text: "Let me just check our system. Yes, here it is, I think. A small green backpack with a yellow star on the pocket was handed in by one of our drivers about an hour ago.",
        },
        { speaker: "Harriet", text: "Oh, that's wonderful! Where was it? I'm sure I put it on the seat next to me." },
        {
          speaker: "Daniel",
          text: "Well, the driver says it wasn't on a seat. It was on the floor, under one of the seats at the back of the bus. It must have fallen off when the bus went round a corner. He kept it in his cab until the end of his shift, and then he took it to the depot.",
        },
        { speaker: "Harriet", text: "So is it at the depot now?" },
        {
          speaker: "Daniel",
          text: "For the moment, yes. Everything from the depot is brought here to our office on Market Street at about four o'clock every afternoon. So you could collect it from us any time after half past four today.",
        },
        { speaker: "Harriet", text: "Oh, I can't come today, I'm afraid. I'm working until seven. What about tomorrow morning?" },
        { speaker: "Daniel", text: "We're open from eight tomorrow." },
        {
          speaker: "Harriet",
          text: "Hmm. I've got a dentist's appointment at half past eight, and I have to go straight to work after that. Are you open at the weekend?",
        },
        { speaker: "Daniel", text: "On Saturdays, yes, from nine until twelve." },
        { speaker: "Harriet", text: "Then I'll come on Saturday morning. It's only a couple of days." },
        {
          speaker: "Daniel",
          text: "That's fine. We'll keep it safe for you. When you come, you'll need to bring something that proves who you are, with your photograph on it. A passport, or a driving licence.",
        },
        {
          speaker: "Harriet",
          text: "My driving licence is in my purse, in the bag, of course! But I can bring my passport. Do you need proof of my address as well? I could bring a letter or a bill.",
        },
        {
          speaker: "Daniel",
          text: "No, that's not necessary, and you don't need your bus ticket either. Just the photo identification.",
        },
        {
          speaker: "Daniel",
          text: "One more thing, Ms Fenwick. We're not allowed to open bags that are handed in, so I can't tell you whether your purse is still inside. If I were you, I'd phone your bank today and tell them what's happened, just to be safe.",
        },
        { speaker: "Harriet", text: "Yes, you're right. I'll do that as soon as we finish. What about my keys? Should I get the locks changed?" },
        { speaker: "Daniel", text: "I wouldn't worry about that. There's nothing in the bag with your address on it, is there?" },
        { speaker: "Harriet", text: "No, nothing. And I suppose the library book can wait until Saturday!" },
        { speaker: "Daniel", text: "I'm sure it can. We'll see you on Saturday, then." },
        { speaker: "Harriet", text: "Thank you so much for your help." },
      ],
      groups: [
        {
          kind: "gap",
          instructions: "Complete the form below.",
          wordLimit: 1,
          allowNumber: true,
          title: "City Buses – Lost Property Report",
          template: [
            "# Passenger",
            "- Name: Harriet [[1]]",
            "- Bus route: number [[2]]",
            "- Got off at: the stop outside the [[3]]",
            "# The bag",
            "- Small dark green backpack made of [[4]]",
            "- On the front pocket: a yellow [[5]] badge",
            "- Inside: a purse, house keys and a [[6]] book",
          ].join("\n"),
          questions: [
            {
              n: 1,
              answer: ["Fenwick"],
              explanation: "Harriet spells her surname, “F, E, N, W, I, C, K,” and the officer repeats it.",
            },
            {
              n: 2,
              answer: ["40", "forty"],
              explanation: "She usually takes the fourteen, but “the forty came first, so I got on that instead.”",
            },
            {
              n: 3,
              answer: ["museum"],
              explanation: "“At the stop outside the museum” — the park is the stop before it.",
            },
            {
              n: 4,
              answer: ["canvas"],
              explanation: "“It's made of canvas, not leather.”",
            },
            {
              n: 5,
              answer: ["star"],
              explanation: "There's no name tag, but “a badge on the front pocket… a little yellow star.”",
            },
            {
              n: 6,
              answer: ["library"],
              explanation: "Purse, keys and “a library book” — she corrects herself about the glasses.",
            },
          ],
        },
        {
          kind: "mcq",
          instructions: "Choose the correct letter, A, B or C.",
          questions: [
            {
              n: 7,
              text: "Where did the driver find the bag?",
              options: [
                { key: "A", text: "on the seat next to where Harriet sat" },
                { key: "B", text: "under a seat at the back of the bus" },
                { key: "C", text: "in the driver's cab" },
              ],
              answer: ["B"],
              explanation:
                "Harriet thought it was on the seat, but “it was on the floor, under one of the seats at the back”; it was only kept in the cab afterwards.",
            },
            {
              n: 8,
              text: "When will Harriet collect the bag?",
              options: [
                { key: "A", text: "this afternoon" },
                { key: "B", text: "tomorrow morning" },
                { key: "C", text: "on Saturday morning" },
              ],
              answer: ["C"],
              explanation: "She works until seven today and has the dentist tomorrow morning: “Then I'll come on Saturday morning.”",
            },
            {
              n: 9,
              text: "What does Harriet need to bring with her?",
              options: [
                { key: "A", text: "a document with her photo on it" },
                { key: "B", text: "the ticket from this morning's journey" },
                { key: "C", text: "a letter showing her address" },
              ],
              answer: ["A"],
              explanation: "“Just the photo identification” — proof of address and the bus ticket aren't needed.",
            },
            {
              n: 10,
              text: "What does the officer advise Harriet to do today?",
              options: [
                { key: "A", text: "change the locks on her house" },
                { key: "B", text: "contact her bank" },
                { key: "C", text: "take the library book back" },
              ],
              answer: ["B"],
              explanation: "“I'd phone your bank today” — new locks aren't needed and the library book can wait.",
            },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// Reading — one short article, 12 questions (TFNG + mcq + sentence completion)
// ===========================================================================

export const PLACEMENT_READING_V1: ExamReadingTest = {
  format: "exam-v2",
  skill: "READING",
  id: "placement-reading-1",
  title: "Placement test · Reading",
  description: "A short article about repair cafés: True / False / Not Given, multiple choice and sentence completion. 1 passage, 12 questions.",
  difficulty: "Medium",
  timeLimit: 15,
  topics: ["community", "environment"],
  source: "averna",
  parts: [
    {
      id: "placement-reading-1-passage",
      title: "The Repair Café",
      subtitle: "Why more and more people are learning to mend the things they own",
      paragraphs: [
        {
          text: "On the first Saturday of every month, the hall of a primary school in the small town of Wrenfield fills with an unusual collection of objects: toasters that no longer toast, lamps that refuse to light, torn jackets and children's bicycles with flat tyres. Their owners have not come to throw them away. They have come to the Wrenfield Repair Café, where volunteers spend four hours helping visitors to mend the things they own.",
        },
        {
          text: "A repair café is a free event at which people bring broken household items and fix them with the help of experienced volunteers. The idea is simple, but it has spread quickly. The first ones opened in Europe in the late 2000s, and today there are thousands of repair cafés around the world. Most of them are run by local residents rather than by businesses or councils. Nobody is charged for the help they receive, although many visitors leave a small donation, which is used to buy tools and spare parts.",
        },
        {
          text: "According to the organisers of the Wrenfield café, saving money is not the main reason why people come. “Most of our visitors could easily afford a new kettle,” explains Joan Pryce, a retired electrician who started the café three years ago. “What they don't like is throwing away something that only needs a new fuse or a few stitches.” Pryce estimates that around two thirds of the items brought in are repaired successfully on the day. Others need a part that has to be ordered, and a small number cannot be saved at all.",
        },
        {
          text: "Supporters of the movement argue that repair is also good for the environment. When an object is thrown away, the energy and materials used to make it are wasted, and many electronic goods end up in landfill sites, where they can release harmful chemicals into the ground. Repairing a device keeps it in use for longer, so fewer new products have to be manufactured. However, the volunteers admit that there are limits to what they can do. Some modern products are designed in a way that makes them very difficult to open, and manufacturers do not always sell spare parts to the public.",
        },
        {
          text: "For many visitors, the most valuable part of the experience is learning. Volunteers are asked not to fix items for people but with them, so that visitors understand what went wrong and can deal with the same problem themselves next time. “At first I just sat and watched,” says Tom Okafor, who brought a broken radio to the café last spring. “By the end, I was holding the screwdriver myself.” Okafor has since become a volunteer, and he now looks after the café's bicycle repairs.",
        },
        {
          text: "The cafés have social benefits too. Many older volunteers have practical skills that younger people have never had the chance to learn, and the events give different generations a reason to spend time together. Pryce believes this explains the café's popularity. “People arrive with a broken toaster and leave with a new friend,” she says. The café now plans to open on two Saturdays a month instead of one, provided that it can find enough volunteers.",
        },
      ],
      groups: [
        {
          kind: "tfng",
          instructions: "Do the following statements agree with the information given in the passage?",
          questions: [
            {
              n: 1,
              text: "The Wrenfield Repair Café is held in a school.",
              answer: ["TRUE"],
              explanation: "It takes place in “the hall of a primary school”.",
            },
            {
              n: 2,
              text: "Visitors have to pay for the help they get.",
              answer: ["FALSE"],
              explanation: "“Nobody is charged for the help they receive” — donations are optional.",
            },
            {
              n: 3,
              text: "Most repair cafés are organised by local councils.",
              answer: ["FALSE"],
              explanation: "Most are run “by local residents rather than by businesses or councils”.",
            },
            {
              n: 4,
              text: "The Wrenfield café receives money from local businesses.",
              answer: ["NOT GIVEN"],
              explanation: "The passage mentions visitors' donations but says nothing about money from businesses.",
            },
            {
              n: 5,
              text: "Joan Pryce used to work as an electrician.",
              answer: ["TRUE"],
              explanation: "She is “a retired electrician”.",
            },
            {
              n: 6,
              text: "Tom Okafor's radio was repaired successfully.",
              answer: ["NOT GIVEN"],
              explanation: "He describes helping with the repair, but we are not told whether the radio worked again.",
            },
          ],
        },
        {
          kind: "mcq",
          instructions: "Choose the correct letter, A, B, C or D.",
          questions: [
            {
              n: 7,
              text: "According to Joan Pryce, why do most people bring items to the café?",
              options: [
                { key: "A", text: "They cannot afford to buy new ones." },
                { key: "B", text: "They dislike throwing away things that are easy to fix." },
                { key: "C", text: "They want to learn a new practical skill." },
                { key: "D", text: "They are unable to find spare parts in the shops." },
              ],
              answer: ["B"],
              explanation: "Most visitors “could easily afford a new kettle”; what they don't like is throwing away something that only needs a small repair.",
            },
            {
              n: 8,
              text: "What does the writer say about some modern products?",
              options: [
                { key: "A", text: "They contain more harmful chemicals than older products." },
                { key: "B", text: "They cost less to replace than to repair." },
                { key: "C", text: "They can be very hard to open." },
                { key: "D", text: "They are usually repaired on the day." },
              ],
              answer: ["C"],
              explanation: "“Some modern products are designed in a way that makes them very difficult to open.”",
            },
            {
              n: 9,
              text: "Why do volunteers fix items with visitors rather than for them?",
              options: [
                { key: "A", text: "so that visitors can solve similar problems on their own in future" },
                { key: "B", text: "because there are not enough volunteers" },
                { key: "C", text: "so that the repairs can be finished more quickly" },
                { key: "D", text: "because visitors must pay for any damage" },
              ],
              answer: ["A"],
              explanation: "So that visitors “can deal with the same problem themselves next time”.",
            },
          ],
        },
        {
          kind: "gap",
          instructions: "Complete the sentences below.",
          wordLimit: 2,
          questions: [
            {
              n: 10,
              text: "Donations from visitors are used to buy tools and [[10]].",
              answer: ["spare parts"],
              explanation: "“A small donation, which is used to buy tools and spare parts.”",
            },
            {
              n: 11,
              text: "In landfill sites, some electronic goods can release harmful [[11]] into the ground.",
              answer: ["chemicals"],
              explanation: "Electronic goods in landfill “can release harmful chemicals into the ground”.",
            },
            {
              n: 12,
              text: "The café will open on two Saturdays a month if it can find enough [[12]].",
              answer: ["volunteers"],
              explanation: "“Provided that it can find enough volunteers.”",
            },
          ],
        },
      ],
    },
  ],
};

// ===========================================================================
// Writing (optional) — a simple opinion prompt
// ===========================================================================

export const PLACEMENT_WRITING_V1: PlacementWritingPrompt = {
  id: "placement-writing-1",
  title: "Learning a language",
  prompt:
    "Some people think the best way to learn a foreign language is in a classroom with a teacher. Others prefer to learn on their own, with apps, films and the internet. Which way do you prefer, and why? Give reasons and examples from your own experience.",
  tips: [
    "Say which way you prefer in your first sentence.",
    "Give two clear reasons, each with an example.",
    "Finish with one sentence that sums up your opinion.",
    "Keep a minute at the end to check your spelling and grammar.",
  ],
  minWords: 120,
  maxWords: 150,
};

// ===========================================================================
// Forms
// ===========================================================================

export const PLACEMENT_FORMS: PlacementForm[] = [
  {
    id: "placement-v1",
    grammar: GV_ITEMS_V1,
    listening: PLACEMENT_LISTENING_V1,
    reading: PLACEMENT_READING_V1,
    writing: PLACEMENT_WRITING_V1,
  },
];

/** The form new sittings get. */
export const CURRENT_FORM_ID = "placement-v1";

export function getPlacementForm(id: unknown): PlacementForm | null {
  return typeof id === "string" ? PLACEMENT_FORMS.find((f) => f.id === id) ?? null : null;
}
