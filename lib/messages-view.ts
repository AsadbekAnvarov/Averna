/**
 * Which half of /messages a phone (< md) shows: the contact list or one conversation.
 * md+ always shows both side by side, so this only drives the `hidden md:*` classes.
 *
 * - a `?with=` contact was picked → the conversation (an unknown id falls back to the
 *   first contact on the page, which is still a conversation);
 * - zero or one contact → the conversation (there is nothing to choose from);
 * - otherwise → the contact list.
 */
export type MessagesPhoneView = "list" | "thread";

export function messagesPhoneView(
  withParam: string | null | undefined,
  contactCount: number
): MessagesPhoneView {
  if (withParam != null && withParam !== "") return "thread";
  return contactCount <= 1 ? "thread" : "list";
}
