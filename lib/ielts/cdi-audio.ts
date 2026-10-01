/**
 * Where the real CDI Listening recordings are hosted.
 *
 * Each imported CDI Listening test (lib/ielts/content/cdi/listening) names ONE
 * MP3 for all four parts (`test.audio.file`, e.g. "listening-1.mp3"). The files
 * live outside the app — by default on GitHub Pages, which serves them with
 * Range requests (206) and `Access-Control-Allow-Origin: *`. A mirror can be
 * configured with CDI_AUDIO_BASE_URL (optional, e.g. a CDN in front of the same
 * files); it must serve the same file names.
 *
 * Server-side use (the client conversion builds the URL; the browser only ever
 * receives the finished URL). Pure — no Node APIs.
 */

export const DEFAULT_CDI_AUDIO_BASE = "https://asadbekanvarov.github.io/averna-cdi-audio/audio/";

/** Only "listening-<n>.mp3": nothing else can be turned into a URL (no paths, queries or other files). */
export const CDI_AUDIO_FILE_RE = /^listening-\d+\.mp3$/;

/** The configured base (CDI_AUDIO_BASE_URL, else the default), with exactly one trailing slash. */
export function cdiAudioBase(): string {
  const raw = String(process.env.CDI_AUDIO_BASE_URL ?? "").trim() || DEFAULT_CDI_AUDIO_BASE;
  return `${raw.replace(/\/+$/, "")}/`;
}

/** Public URL of a CDI recording, or null when the file name isn't a CDI Listening recording. */
export function cdiAudioUrl(file: unknown): string | null {
  if (typeof file !== "string" || !CDI_AUDIO_FILE_RE.test(file)) return null;
  return cdiAudioBase() + encodeURIComponent(file);
}
