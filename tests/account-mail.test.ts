// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountLink,
  accountMailConfigured,
  verificationRequired,
} from "@/lib/account/mail";
afterEach(() => vi.unstubAllEnvs());
describe("trusted email links", () => {
  it("never builds links from a request host", () => {
    vi.stubEnv("ACCOUNT_APP_URL", "https://school.example/some-path");
    expect(accountLink("/auth/reset-password", "abc")).toBe(
      "https://school.example/auth/reset-password?token=abc",
    );
  });
  it("requires HTTPS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACCOUNT_APP_URL", "http://school.example");
    expect(() => accountLink("/auth/reset-password", "abc")).toThrow();
  });
  it("rejects credentials in the configured origin", () => {
    vi.stubEnv("ACCOUNT_APP_URL", "https://user:pass@school.example");
    expect(() => accountLink("/auth/reset-password", "abc")).toThrow();
  });
  it("requires all provider settings", () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("ACCOUNT_MAIL_FROM", "");
    vi.stubEnv("ACCOUNT_APP_URL", "https://school.example");
    expect(accountMailConfigured()).toBe(false);
  });
  it("does not silently enable verification", () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "false");
    expect(verificationRequired()).toBe(false);
  });
});
