import { z } from "zod";
/** Versioned inside existing JSON. Legacy attempts keep their original four-section rules. */
export const CD_MOCK_MODE = "cd-v1" as const;
export const CD_MOCK_SECTIONS = ["LISTENING", "READING", "WRITING"] as const;
export const LEGACY_MOCK_SECTIONS = [...CD_MOCK_SECTIONS, "SPEAKING"] as const;
export const CD_TRANSPORT_GRACE_MS = 5_000;
export const MOCK_MAX_BODY_BYTES = 256_000;
export const MOCK_MAX_DRAFT_CHARS = 80_000;
export const paperSchema = z.object({ listening: z.string().min(1), reading: z.string().min(1), task1: z.string().min(1), task2: z.string().min(1), speaking: z.string(), mode: z.literal(CD_MOCK_MODE).optional() }).passthrough().refine(p => p.mode === CD_MOCK_MODE || !!p.speaking);
export function isCdMock(papers: unknown): boolean { return !!papers && typeof papers === "object" && !Array.isArray(papers) && (papers as Record<string, unknown>).mode === CD_MOCK_MODE; }
export function mockSections(papers: unknown) { return isCdMock(papers) ? CD_MOCK_SECTIONS : LEGACY_MOCK_SECTIONS; }
export function mockGrace(papers: unknown) { return isCdMock(papers) ? CD_TRANSPORT_GRACE_MS : 120_000; }
const answers = z.record(z.string().regex(/^(?:[1-9]|[1-3][0-9]|40)$/), z.union([z.string().max(1000), z.array(z.string().max(200)).max(10)]));
export const objectiveDraftSchema = z.object({ answers }).strict();
export const writingDraftSchema = z.object({ essays: z.object({ task1: z.string().max(39_000), task2: z.string().max(39_000) }).strict() }).strict();
export function validMockDraft(section: number, value: unknown): boolean { return (section === 0 || section === 1 ? objectiveDraftSchema : section === 2 ? writingDraftSchema : z.never()).safeParse(value).success; }
export const mockIndexSchema = z.number().int().min(0).max(3);
export const beginMockSchema = z.object({ section: mockIndexSchema }).strict();
export const saveMockSchema = z.object({ section: mockIndexSchema, draft: z.unknown(), revision: z.number().int().min(0).max(1_000_000).optional() }).strict().refine(v => validMockDraft(v.section, v.draft));
export const submitMockSchema = z.object({ section: mockIndexSchema, payload: z.unknown(), fromDraft: z.literal(true).optional(), revision: z.number().int().min(0).max(1_000_000).optional() }).strict().refine(v => v.section === 3 || validMockDraft(v.section, v.payload));
export function nextClock(previousDeadline: number, receivedAt: number) { return Math.min(previousDeadline, receivedAt); }
