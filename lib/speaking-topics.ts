export interface SpeakingTopic {
  topic: string;
  questions: string[];
}

// A rotating set of daily Speaking topics with discussion questions.
export const SPEAKING_TOPICS: SpeakingTopic[] = [
  {
    topic: "Travel & Holidays",
    questions: [
      "What is the best trip you have ever taken, and why?",
      "Do you prefer travelling alone or with others?",
      "How has tourism changed your country?",
      "Where would you go if you could travel anywhere tomorrow?",
    ],
  },
  {
    topic: "Technology in Daily Life",
    questions: [
      "How has technology changed the way you study?",
      "Do you think people spend too much time on their phones?",
      "What piece of technology could you not live without?",
      "Will AI make life better or worse in the future?",
    ],
  },
  {
    topic: "Education & Learning",
    questions: [
      "What makes a good teacher?",
      "Should students choose subjects they enjoy or useful ones?",
      "Is online learning as effective as classroom learning?",
      "What skill do you most want to learn and why?",
    ],
  },
  {
    topic: "Health & Lifestyle",
    questions: [
      "What do you do to stay healthy?",
      "Do you think people in cities live healthily?",
      "How important is sleep for students?",
      "Should the government do more to promote healthy living?",
    ],
  },
  {
    topic: "The Environment",
    questions: [
      "What environmental problem worries you most?",
      "What can individuals do to protect the planet?",
      "Should plastic bags be banned?",
      "Is your city doing enough to stay green?",
    ],
  },
  {
    topic: "Work & Future Careers",
    questions: [
      "What is your dream job and why?",
      "Is it better to have one career or several?",
      "How important is money when choosing a job?",
      "Will remote work become the norm?",
    ],
  },
  {
    topic: "Hobbies & Free Time",
    questions: [
      "How do you usually spend your free time?",
      "Have your hobbies changed since childhood?",
      "Do you prefer indoor or outdoor activities?",
      "Should schools give students more free time?",
    ],
  },
];

import { tashkentDayOfYear } from "@/lib/utils";

export function getTodayTopic(): SpeakingTopic {
  return SPEAKING_TOPICS[tashkentDayOfYear() % SPEAKING_TOPICS.length];
}

export function isSpeakingTimeNow(): boolean {
  const h = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false }).format(new Date()),
    10
  ) % 24;
  return h >= 19 && h < 21;
}
