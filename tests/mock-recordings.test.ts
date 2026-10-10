import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({audio:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{listeningAudio:{findMany:m.audio}}}));
import { LISTENING_SEED } from "@/lib/ielts/content";
import { listeningClientContent } from "@/lib/ielts/audio/client";
import { partAudioHash } from "@/lib/ielts/audio/hash";
import { TTS_MODEL } from "@/lib/openai-audio";
import { decideScript } from "@/lib/ielts/audio/script-access";
const test=LISTENING_SEED[0];
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("LISTENING_AUDIO","on");m.audio.mockResolvedValue(test.parts.map((_,i)=>({partIndex:i,url:`https://cdn.test/${i}.mp3`,durationMs:60000,scriptHash:partAudioHash(test,i,TTS_MODEL()),timeline:[]})));});
describe("recordings-only mocks",()=>{
 it("ships four existing files and no answer-bearing scripts",async()=>{const c=await listeningClientContent(test,{recordingsOnly:true});expect(c?.parts).toHaveLength(4);for(const p of c!.parts){expect(p.audio).toBeTruthy();expect(p.script).toEqual([]);} });
 it("refuses missing/stale/unready recordings instead of substituting voices",async()=>{m.audio.mockResolvedValueOnce([]);expect(await listeningClientContent(test,{recordingsOnly:true})).toBeNull();m.audio.mockResolvedValueOnce(test.parts.map((_,i)=>({partIndex:i,url:"https://cdn.test/file.mp3",durationMs:60000,scriptHash:"stale",timeline:[]})));expect(await listeningClientContent(test,{recordingsOnly:true})).toBeNull();vi.stubEnv("LISTENING_AUDIO","off");expect(await listeningClientContent(test,{recordingsOnly:true})).toBeNull();});
 it("server denies script fallback for new mock, including forged direct calls",async()=>{const catalog=vi.fn();const r=await decideScript({context:"mock",testId:test.id,part:0},"s",{activeMocks:async()=>[{id:"a",status:"active",current:0,sectionStartedAt:new Date(),papers:{mode:"cd-v1",listening:test.id}}],mockSections:["LISTENING","READING","WRITING","SPEAKING"],catalogTest:catalog} as any);expect(r).toMatchObject({ok:false,status:403});expect(catalog).not.toHaveBeenCalled();});
});
