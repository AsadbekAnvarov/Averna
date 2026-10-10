import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({session:vi.fn(),raw:vi.fn(),student:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{mockSession:{findUnique:m.session}}}));
import { assertSessionReviewer } from "@/lib/group-mock/reviewer";
import { isFullSpeakingTest } from "@/lib/review/answers";
const session={id:"s",groupId:"g",teacherId:"teacher",teacher:{userId:"owner",user:{role:"TEACHER"}},group:{teacherId:"teacher"}};
beforeEach(()=>{vi.resetAllMocks();m.session.mockResolvedValue(session);m.student.mockResolvedValue({id:"student",userId:"learner",groupId:"g",blacklisted:false,user:{role:"STUDENT"}});m.raw.mockImplementation(async(_sql:any,id:string)=>[{role:id==="owner"?"TEACHER":"STUDENT"}]);});
describe("published group corrections",()=>{
 it("leaves legacy reviews unchanged without group-table access",async()=>{expect(await assertSessionReviewer("owner",{})).toBe(true);expect(m.session).not.toHaveBeenCalled();});
 it("requires original teacher and current class ownership",async()=>{expect(await assertSessionReviewer("other",{groupSessionId:"s"})).toBe(false);m.session.mockResolvedValue({...session,group:{teacherId:"replacement"}});expect(await assertSessionReviewer("owner",{groupSessionId:"s"})).toBe(false);});
 it("locks and rechecks teacher/student roles and membership before corrections",async()=>{const tx:any={$queryRaw:m.raw,mockSession:{findUnique:m.session},student:{findUnique:m.student}};expect(await assertSessionReviewer("owner",{groupSessionId:"s"},tx,"student")).toBe(true);expect(m.raw.mock.calls.some(([sql])=>String(sql[0]).includes('"groups"'))).toBe(true);m.student.mockResolvedValue({userId:"learner",groupId:"other",blacklisted:false,user:{role:"STUDENT"}});expect(await assertSessionReviewer("owner",{groupSessionId:"s"},tx,"student")).toBe(false);m.raw.mockResolvedValue([{role:"ADMIN"}]);expect(await assertSessionReviewer("owner",{groupSessionId:"s"},tx,"student")).toBe(false);});
 it("labels actual teacher-conducted Speaking as full, without inventing recorded answers",()=>{expect(isFullSpeakingTest({inputMode:"in-person",teacherConducted:true})).toBe(true);expect(isFullSpeakingTest({inputMode:"in-person",teacherConducted:false})).toBe(false);expect(isFullSpeakingTest({answers:[]})).toBe(true);});
});
