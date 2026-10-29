/**
 * Content_Importer (Volume 10): which paper a source file is.
 * Offline only — never imported by the app (tests/cdi-import-guard.test.ts).
 */

export type SourceSkill = "READING" | "LISTENING";

export interface SourceMeta {
  /** The file name exactly as on disk (case and spaces kept). */
  file: string;
  /** Lowercase hex SHA-256 of the file bytes. */
  sha256: string;
  id: string;
  number: number;
  skill: SourceSkill;
}

/** "vol 10 test 7 reading.html" → { skill: "READING", number: 7, id: "cdi-v10-reading-07" }; null when it isn't a test file. */
export function identifySource(fileName: string): Pick<SourceMeta, "skill" | "number" | "id"> | null {
  const name = fileName.toLowerCase();
  if (!name.endsWith(".html") && !name.endsWith(".htm")) return null;
  const skill: SourceSkill | null = /reading/.test(name) ? "READING" : /listening/.test(name) ? "LISTENING" : null;
  const m = /test\s*(\d+)/.exec(name);
  if (!skill || !m) return null;
  const number = Number(m[1]);
  if (!Number.isInteger(number) || number < 1 || number > 99) return null;
  return { skill, number, id: `cdi-v10-${skill.toLowerCase()}-${String(number).padStart(2, "0")}` };
}

export function paperTitle(skill: SourceSkill, number: number): string {
  return `Volume 10 · ${skill === "READING" ? "Reading" : "Listening"} Test ${number}`;
}
