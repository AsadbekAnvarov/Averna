// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  consume: vi.fn(),
  update: vi.fn(),
  user: vi.fn(),
  transaction: vi.fn(),
  stamp: vi.fn(),
  send: vi.fn(),
  create: vi.fn(),
  query: vi.fn(),
  hash: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));
vi.mock("@/lib/account/mail", () => ({ sendAccountMail: mocks.send }));
vi.mock("@/lib/account/session-guard", () => ({
  passwordStamp: (d: Date | null) => d?.getTime() ?? 0,
  markPasswordChanged: mocks.stamp,
}));
vi.mock("@/lib/db", () => ({
  db: {
    accountToken: { findUnique: mocks.find, deleteMany: mocks.consume },
    $transaction: mocks.transaction,
  },
}));
import { consumeAccountLink } from "@/lib/account/recovery";
const token = "a".repeat(64);
const user = {
  id: "u1",
  email: "student@example.test",
  username: "studentone",
  passwordChangedAt: null,
};
describe("single-use account links", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.hash.mockResolvedValue("hashed-new-password");
    mocks.find.mockResolvedValue({
      tokenHash: "hash",
      userId: "u1",
      purpose: "reset",
      email: user.email,
      expiresAt: new Date(Date.now() + 60000),
      user,
    });
    mocks.user.mockResolvedValue(user);
    mocks.consume.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (fn) =>
      fn({
        $queryRaw: mocks.query,
        user: { findUnique: mocks.user, update: mocks.update },
        accountToken: { deleteMany: mocks.consume, create: mocks.create },
      }),
    );
  });
  it("rejects malformed tokens without a database read", async () => {
    expect(
      (await consumeAccountLink("bad", "reset", "AstrongPass123!")).ok,
    ).toBe(false);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("refuses the wrong token purpose", async () =>
    expect((await consumeAccountLink(token, "verify")).ok).toBe(false));
  it("refuses expired tokens", async () => {
    mocks.find.mockResolvedValue({
      user,
      email: user.email,
      purpose: "reset",
      expiresAt: new Date(0),
    });
    expect(
      (await consumeAccountLink(token, "reset", "AstrongPass123!")).ok,
    ).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("binds the link to the issued email", async () => {
    mocks.find.mockResolvedValue({
      user,
      email: "old@example.test",
      purpose: "reset",
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(
      (await consumeAccountLink(token, "reset", "AstrongPass123!")).ok,
    ).toBe(false);
  });
  it("refuses published demo/common passwords", async () => {
    expect((await consumeAccountLink(token, "reset", "student123")).ok).toBe(
      false,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not update when a concurrent request already consumed the token", async () => {
    mocks.consume.mockResolvedValue({ count: 0 });
    expect(
      (await consumeAccountLink(token, "reset", "AstrongPass123!")).ok,
    ).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("changes the password and invalidates old sessions after consumption", async () => {
    expect(
      (await consumeAccountLink(token, "reset", "AstrongPass123!")).ok,
    ).toBe(true);
    expect(mocks.update.mock.calls[0][0].data.password).toBe(
      "hashed-new-password",
    );
    expect(mocks.update.mock.calls[0][0].data.passwordChangedAt).toBeInstanceOf(
      Date,
    );
    expect(mocks.stamp).toHaveBeenCalledOnce();
  });
  it("confirms email without changing the password", async () => {
    mocks.find.mockResolvedValue({
      userId: "u1",
      user,
      email: user.email,
      purpose: "verify",
      expiresAt: new Date(Date.now() + 60000),
    });
    expect((await consumeAccountLink(token, "verify")).ok).toBe(true);
    expect(mocks.update.mock.calls[0][0].data.emailVerified).toBeInstanceOf(
      Date,
    );
    expect(mocks.update.mock.calls[0][0].data.password).toBeUndefined();
    expect(mocks.stamp).not.toHaveBeenCalled();
  });
});
