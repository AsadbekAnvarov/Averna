/** Natural order: Test 2 precedes Test 10, independent of upload timestamp.
 * Original numbers/IDs stay unchanged (including gaps in the supplied papers).
 */
const titleOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareTestTitles(a: { title: string; id: string }, b: { title: string; id: string }): number {
  return titleOrder.compare(a.title, b.title) || titleOrder.compare(a.id, b.id);
}
