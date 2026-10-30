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

describe('display aliases without changing the source papers',()=>{
 it('uses the same contiguous Listening title in the library and opened paper, preserving recording hashes',async()=>{
  const {getListeningExam}=await import('@/lib/ielts/catalog');const {wholeRecordingHash}=await import('@/lib/ielts/audio/hash');
  const rows=[34,35,37].map(n=>({id:`cdi-listening-${n}`,module:'LISTENING',published:true,title:`Averna CDI Listening ${n}`,data:{...structuredClone(LISTENING_SEED[0]),source:'imported',title:`Averna CDI Listening ${n}`}}));
  m.rows.mockResolvedValue(rows);m.row.mockResolvedValue(rows[2]);
  expect((await listListeningExams()).filter(t=>t.source==='imported').map(t=>t.title)).toEqual([1,2,3].map(n=>`Averna CDI Listening ${n}`));
  const opened=await getListeningExam(rows[2].id);expect(opened?.title).toBe('Averna CDI Listening 3');expect(opened?.id).toBe(rows[2].id);expect(wholeRecordingHash(opened!)).toBe(wholeRecordingHash(rows[2].data));expect(rows[2].data.title).toBe('Averna CDI Listening 37');
 });
 it('uses the same contiguous Reading title in the library and opened paper',async()=>{
  const rows=[1,3,9].map(n=>({id:`cdi-reading-${n}`,module:'READING',published:true,data:{...structuredClone(READING_SEED[0]),source:'imported',title:`Averna CDI Reading ${n}`}}));m.rows.mockResolvedValue(rows);m.row.mockResolvedValue(rows[2]);
  expect((await listReadingExams()).filter(t=>t.source==='imported').map(t=>t.title)).toEqual([1,2,3].map(n=>`Averna CDI Reading ${n}`));expect((await getReadingExam(rows[2].id))?.title).toBe('Averna CDI Reading 3');expect(rows[2].data.title).toBe('Averna CDI Reading 9');
 });
 it('numbers Writing independently and retains the original prompt and chart',async()=>{
  const rows=[2,6,9].map(n=>({id:`cdi-writing-${n}-task1`,data:{id:`cdi-writing-${n}-task1`,title:`Averna CDI Writing ${n} · Task 1`,prompt:'Summarise the supplied chart and compare its main features.',type:'Imported CDI',imageUrl:`https://cdn.test/chart-${n}.webp`,imported:{provider:'user-supplied-cdi',file:`Writing-Task-${n}.html`,sha256:'a'.repeat(64),importVersion:1}}}));m.rows.mockResolvedValue(rows);
  const list=await getWritingPrompts('task1');expect(list.map(t=>t.title)).toEqual([1,2,3].map(n=>`Averna CDI Writing ${n} · Task 1`));const opened=await getWritingTask('task1',rows[2].id);expect(opened?.title).toBe(list[2].title);expect(opened?.imageUrl).toBe(rows[2].data.imageUrl);expect(opened?.prompt).toBe(rows[2].data.prompt);expect(rows[2].data.title).toBe('Averna CDI Writing 9 · Task 1');
 });
});
