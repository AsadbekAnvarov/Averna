/** Natural order: Test 2 precedes Test 10, independent of upload timestamp.
 * Source sorting retains original numbers/IDs; display numbering is separate.
 */
const titleOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareTestTitles(a: { title: string; id: string }, b: { title: string; id: string }): number {
  return titleOrder.compare(a.title, b.title) || titleOrder.compare(a.id, b.id);
}

/** Contiguous public-facing numbers for available CDI papers, never new IDs.
 * Call after canonical sorting and before UI filters so a paper keeps its number
 * when changing level/type. Collections and Writing tasks each start at one.
 * Source rows, filenames and content used by recording hashes stay untouched.
 */
export function sequentialCatalogTitles<T extends { id: string; title: string }>(
  items: readonly T[], scope: (item: T) => string = () => "",
): T[] {
  const positions = new Map<string, number>();
  return items.map(item => {
    const match = /^(Averna\s+CDI\b.*?\b(Reading|Listening|Writing)(?:\s+Test)?\s+)(\d+)(.*)$/i.exec(item.title);
    if (!match) return item;
    const [, prefix, skill, , suffix] = match;
    const volume = /\bVolume\s*(\d+)\b/i.exec(prefix)?.[1] ?? "original";
    const task = skill.toLowerCase() === "writing" ? /\bTask\s*([12])\b/i.exec(suffix)?.[1] ?? "" : "";
    const key = JSON.stringify([scope(item), skill.toLowerCase(), volume, task]);
    const position = (positions.get(key) ?? 0) + 1;
    positions.set(key, position);
    return { ...item, title: `${prefix}${position}${suffix}` };
  });
}
