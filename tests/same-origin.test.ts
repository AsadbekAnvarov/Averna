// @vitest-environment node
import { describe, expect, it } from "vitest";
import { trustedMutation } from "@/lib/security/same-origin";
describe("browser mutation origin", () => {
  it("accepts same-origin calls", () =>
    expect(
      trustedMutation(
        new Request("https://school.example/api/mistakes", {
          headers: { origin: "https://school.example" },
        }),
      ),
    ).toBe(true));
  it("refuses other origins, including sibling subdomains", () =>
    expect(
      trustedMutation(
        new Request("https://school.example/api/mistakes", {
          headers: { origin: "https://other.school.example" },
        }),
      ),
    ).toBe(false));
  it("refuses opaque cross-site requests", () =>
    expect(
      trustedMutation(
        new Request("https://school.example/api/mistakes", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false));
  it("allows CLI calls without browser headers (other auth still required)", () =>
    expect(
      trustedMutation(new Request("https://school.example/api/mistakes")),
    ).toBe(true));
  it("accepts the served Host when Next uses an internal localhost URL", () => {
    expect(
      trustedMutation(
        new Request("http://localhost:3000/api/mistakes", {
          headers: {
            origin: "http://127.0.0.1:3000",
            host: "127.0.0.1:3000",
            "x-forwarded-proto": "http",
          },
        }),
      ),
    ).toBe(true);
  });
  it("accepts HTTPS terminated by a trusted proxy", () => {
    expect(
      trustedMutation(
        new Request("http://upstream:3000/api/mistakes", {
          headers: {
            origin: "https://school.example",
            host: "school.example",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toBe(true);
  });
});
