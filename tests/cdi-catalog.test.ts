import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({rows:vi.fn(),row:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{generatedTest:{findMany:m.rows,findUnique:m.row}}}));
vi.mock("react",async()=>({...await vi.importActual<typeof import("react")>("react"),cache:(fn:unknown)=>fn}));
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}));
import { listReadingExams, listListeningExams, listSpeakingSets, getReadingExam, getWritingTask } from "@/lib/ielts/catalog";
import { getWritingPrompts } from "@/lib/writing-content";
import { getSpeakingContent } from "@/lib/speaking-content";
import { READING_SEED, LISTENING_SEED, WRITING_SEED } from "@/lib/ielts/content";
import { SOURCE_LABEL } from "@/components/library/badges";
beforeEach(()=>{vi.resetAllMocks();m.rows.mockResolvedValue([]);});
describe("CDI catalog retirement without deleting history",()=>{
 it("removes original seeds from all new libraries",async()=>{
  expect((await listReadingExams()).some(t=>t.source==="averna")).toBe(false);
  expect((await listListeningExams()).some(t=>t.source==="averna")).toBe(false);
  expect(await listSpeakingSets()).toEqual([]);
  expect(await getWritingPrompts("task1")).toEqual([]);expect(await getWritingPrompts("task2")).toEqual([]);
  expect(await getSpeakingContent()).toEqual({part1Topics:[],part2Cards:[],part3Questions:[]});
 });
 it("preserves retired references for already allocated Mock attempts",async()=>{
  expect((await getReadingExam(READING_SEED[0].id))?.id).toBe(READING_SEED[0].id);
  expect((await getWritingTask("task1",WRITING_SEED.task1[0].id))?.id).toBe(WRITING_SEED.task1[0].id);
 });
 it("keeps published imported R/L provenance and uses Averna CDI label",async()=>{
  m.rows.mockImplementation(async({where}:{where:{module:string}})=>[{id:"published-cdi",data:{...(where.module==="READING"?READING_SEED[0]:LISTENING_SEED[0]),source:"imported"}}]);
  expect((await listReadingExams())[0].source).toBe("imported");expect((await listListeningExams())[0].source).toBe("imported");
  expect(SOURCE_LABEL.imported).toBe("Averna CDI");
 });
 it("does not resurrect retired originals when the database fails",async()=>{
  m.rows.mockRejectedValue(new Error("offline"));
  expect((await listReadingExams()).some(t=>t.source==="averna")).toBe(false);
  expect((await listListeningExams()).some(t=>t.source==="averna")).toBe(false);
  expect(await listSpeakingSets()).toEqual([]);expect(await getWritingPrompts("task2")).toEqual([]);
 });
});
