import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoleSessionCache } from "./role-session.mjs";

function context(value = "student-session") {
  return {
    restored: null,
    async cookies() { return [{ name: "authjs.session-token", value, domain: "localhost", path: "/" }]; },
    async addCookies(cookies) { this.restored = cookies; },
  };
}

test("reuses one sign-in across fresh scenario contexts, in memory only", async () => {
  const ensure = createRoleSessionCache();
  let calls = 0;
  const signIn = async () => { calls++; };
  for (let i = 0; i < 15; i++) {
    const ctx = context();
    await ensure(ctx, "http://localhost:3000", "student", {}, signIn);
    assert.equal(ctx.restored === null, i === 0);
  }
  assert.equal(calls, 1);
});

test("never mixes roles or origins", async () => {
  const ensure = createRoleSessionCache();
  let calls = 0;
  const signIn = async () => { calls++; };
  await ensure(context("student"), "http://localhost:3000", "student", {}, signIn);
  await ensure(context("teacher"), "http://localhost:3000", "teacher", {}, signIn);
  await ensure(context("base"), "http://localhost:3001", "student", {}, signIn);
  const student = context();
  const teacher = context();
  await ensure(student, "http://localhost:3000/calendar", "student", {}, signIn);
  await ensure(teacher, "http://localhost:3000", "teacher", {}, signIn);
  assert.equal(student.restored[0].value, "student");
  assert.equal(teacher.restored[0].value, "teacher");
  assert.equal(calls, 3);
});

test("does not cache a failed sign-in", async () => {
  const ensure = createRoleSessionCache();
  await assert.rejects(ensure(context(), "http://localhost:3000", "student", {}, async () => { throw new Error("limited"); }));
  let calls = 0;
  await ensure(context(), "http://localhost:3000", "student", {}, async () => { calls++; });
  assert.equal(calls, 1);
});

test("restored cookies cannot mutate the cache; new suite authenticates anew", async () => {
  const ensure = createRoleSessionCache();
  let calls = 0;
  const signIn = async () => { calls++; };
  await ensure(context(), "http://localhost:3000", "student", {}, signIn);
  const first = context();
  await ensure(first, "http://localhost:3000", "student", {}, signIn);
  first.restored[0].value = "mutated";
  const second = context();
  await ensure(second, "http://localhost:3000", "student", {}, signIn);
  assert.equal(second.restored[0].value, "student-session");
  await createRoleSessionCache()(context(), "http://localhost:3000", "student", {}, signIn);
  assert.equal(calls, 2);
});
