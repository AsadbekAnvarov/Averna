import type { PeerFormat } from "./matching";

/** Student-facing descriptions of the peer formats (docs/peer-speaking.md §2). */
export const FORMAT_INFO: Record<PeerFormat, { title: string; minutes: string; text: string }> = {
  exam: {
    title: "Mock interview",
    minutes: "~25 min",
    text: "IELTS Parts 1–3 with one of you as the examiner, then swap roles.",
  },
  quick: {
    title: "Quick cue card",
    minutes: "~10 min",
    text: "Part 2 only: 1 minute to prepare, 2 minutes to talk, a follow-up, then swap.",
  },
  conversation: {
    title: "Guided conversation",
    minutes: "~12 min",
    text: "Free talk with prompt cards for your level — a new card every 2 minutes or on Next.",
  },
  debate: {
    title: "Debate",
    minutes: "~15 min",
    text: "One motion, one side each: a 2-minute opening and a 1-minute rebuttal, then swap sides.",
  },
};
