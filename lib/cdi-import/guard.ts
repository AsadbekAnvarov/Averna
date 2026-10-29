/** Source references that must never reach Averna (the source's Telegram channel). */

import type { ExamTest } from "../ielts/types";

const BANNED = [/ielts_volume/i, /t\.me\//i];

/** Every text of a paper with where it sits. */
export function paperTexts(test: ExamTest): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, text: string | undefined) => {
    if (text) out.push({ where, text });
  };
  add("title", test.title);
  add("description", test.description);
  test.parts.forEach((p, i) => {
    const at = `part ${i + 1}`;
    add(`${at} title`, p.title);
    if ("paragraphs" in p) {
      add(`${at} subtitle`, p.subtitle);
      p.paragraphs.forEach((x, j) => add(`${at} paragraph ${j + 1}`, x.text));
    } else {
      add(`${at} context`, p.context);
      p.script.forEach((l, j) => add(`${at} transcript line ${j + 1}`, `${l.speaker} ${l.text}`));
    }
    p.groups.forEach((g, j) => {
      const gat = `${at} group ${j + 1}`;
      add(`${gat} instructions`, g.instructions);
      add(`${gat} rule`, g.answerRule);
      add(`${gat} title`, g.title);
      add(`${gat} template`, g.template);
      g.options?.forEach((o) => add(`${gat} option ${o.key}`, o.text));
      g.images?.forEach((im, k) => add(`${gat} image ${k + 1} alt`, im.alt));
      g.questions.forEach((q) => {
        add(`${gat} question ${q.n}`, q.text);
        q.options?.forEach((o) => add(`${gat} question ${q.n} option ${o.key}`, o.text));
      });
    });
  });
  return out;
}

export function findBannedReferences(test: ExamTest): { where: string }[] {
  return paperTexts(test).filter((t) => BANNED.some((re) => re.test(t.text))).map((t) => ({ where: t.where }));
}
