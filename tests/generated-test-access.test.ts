import { describe, expect, it } from "vitest";
import { generatedTestOwnerFilter } from "@/lib/ielts/generated-test-access";
describe("generated test ownership", () => {
  it("keeps admins able to manage all authors", () => expect(generatedTestOwnerFilter({id:"a",role:"ADMIN"})).toEqual({}));
  it("scopes teachers to their own rows", () => expect(generatedTestOwnerFilter({id:"t",role:"TEACHER"})).toEqual({createdById:"t"}));
  it.each([{id:"s",role:"STUDENT"},{id:"",role:"TEACHER"},{id:"anonymous"}])("rejects unauthorized ownership %j", user => expect(()=>generatedTestOwnerFilter(user)).toThrow());
});
