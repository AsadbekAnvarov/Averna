/**
 * Shapes of the admin Listening-audio API (/api/admin/listening-audio/*),
 * shared by the routes and the admin manager. Pure types + constants —
 * safe in client components.
 */

/**
 * none   no recording yet (students hear browser voices)
 * ready  recording matches the part's current script (students hear it)
 * stale  a recording exists but the script / voices changed since — students
 *        hear browser voices until it's rendered again
 * failed the last render failed and there is no recording
 */
export type PartAudioStatus = "none" | "ready" | "stale" | "failed";

export interface PartAudioInfo {
  index: number;
  /** "Part 1" … */
  title: string;
  status: PartAudioStatus;
  url: string | null;
  bytes: number;
  durationMs: number;
  /** Last render error (also kept when an older recording is still served). */
  error: string | null;
  /** ISO time of the last change. */
  updatedAt: string | null;
  /** Lines to synthesise (announcements included) — a render costs about one request each. */
  lines: number;
  /** Rough length of the recording before it exists (s). */
  estimatedSeconds: number;
}

export interface TestAudioInfo {
  id: string;
  title: string;
  source: "averna" | "generated" | "legacy";
  difficulty: string;
  /** Full 4-part, 40-question paper (used by the mock exam). */
  full: boolean;
  /** The placement (entry) test's Listening — not in the library; with a recording its script stays off the page. */
  placement: boolean;
  parts: PartAudioInfo[];
}

/** Recordings of tests that are no longer in the catalog (unpublished / deleted). */
export interface OrphanAudioInfo {
  testId: string;
  parts: { index: number; status: string; bytes: number; durationMs: number; url: string | null }[];
  bytes: number;
}

export interface AudioOverview {
  blobConfigured: boolean;
  openAiConfigured: boolean;
  /** LISTENING_AUDIO=off: recordings aren't served — students hear browser voices everywhere (lib/ielts/audio/client). */
  audioOff: boolean;
  voiceModel: string;
  /** The recordings table couldn't be read (e.g. prisma/sql/deploy.sql not applied yet). */
  dbError: string | null;
  tests: TestAudioInfo[];
  orphans: OrphanAudioInfo[];
  totals: {
    /** Bytes of every stored recording (stale and orphaned ones included — they still take space). */
    bytes: number;
    files: number;
    ready: number;
    stale: number;
    failed: number;
    missing: number;
    /** Audio minutes students can hear now (ready parts). */
    readyMs: number;
    /** Measured bytes per second of audio (null until something is rendered). */
    bytesPerSecond: number | null;
  };
  /**
   * Recorded Speaking answers in the same Blob store (lib/speaking/recording
   * speakingStorageUsage): the files still kept, and this month's (UTC) stored
   * answers — the count SPEAKING_AUDIO_MONTHLY_UPLOADS is checked against. null
   * when it couldn't be read.
   */
  speaking: { bytes: number; files: number; uploadsThisMonth: number; monthlyLimit: number } | null;
  generatedAt: string;
}

/** POST /api/admin/listening-audio/render → 200. */
export interface RenderOk {
  ok: true;
  part: PartAudioInfo;
  /** Seconds the render took on the server. */
  seconds: number;
}

/** Why a request failed: the queue pauses on rate_limit, stops on config / storage, retries busy later. */
export type AudioErrorCode = "invalid" | "not_found" | "config" | "rate_limit" | "busy" | "timeout" | "upstream" | "audio" | "storage" | "server";

export interface AudioErrorBody {
  ok?: false;
  error: string;
  code?: AudioErrorCode;
  retryAfterSec?: number;
  part?: PartAudioInfo;
}

/** Vercel Blob storage included in the Hobby plan. */
export const HOBBY_BLOB_BYTES = 1024 * 1024 * 1024;
/** Before anything is rendered: ~128–160 kbps speech ≈ 1.1 MB per minute. */
export const DEFAULT_BYTES_PER_SECOND = 18_000;
/** gpt-4o-mini-tts ≈ $0.015 per minute of audio (OpenAI's estimate). */
export const TTS_USD_PER_MINUTE = 0.015;
/** A full Listening test ≈ 30 minutes of audio. */
export const FULL_TEST_MINUTES = 30;
