/**
 * /messages on phones (B5, task 5.3): which half — contact list or conversation — is shown.
 * **Validates: Requirements 2.10**
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { messagesPhoneView } from "@/lib/messages-view";

describe("messagesPhoneView", () => {
  it("examples", () => {
    expect(messagesPhoneView(undefined, 0)).toBe("thread");
    expect(messagesPhoneView(undefined, 1)).toBe("thread");
    expect(messagesPhoneView(undefined, 2)).toBe("list");
    expect(messagesPhoneView("", 5)).toBe("list");
    expect(messagesPhoneView("u1", 5)).toBe("thread");
    expect(messagesPhoneView("someone-else", 5)).toBe("thread");
  });

  it("property: a picked contact (own or unknown id) or ≤ 1 contact → thread, otherwise list", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 60 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            fc.oneof(
              fc.constant<string | undefined>(undefined),
              // id of one of the contacts
              n > 0 ? fc.integer({ min: 0, max: n - 1 }).map((i) => `contact-${i}`) : fc.constant<string | undefined>(undefined),
              // a foreign id (not a contact of this user)
              fc.string({ minLength: 1, maxLength: 20 }).map((s) => `foreign-${s}`)
            )
          )
        ),
        ([count, withParam]) => {
          const expected = withParam !== undefined || count <= 1 ? "thread" : "list";
          expect(messagesPhoneView(withParam, count)).toBe(expected);
        }
      ),
      { numRuns: 300 }
    );
  });
});
