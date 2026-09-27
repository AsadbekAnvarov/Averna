/**
 * Minimal Vercel Blob client (REST, no SDK dependency).
 *
 * Mirrors what @vercel/blob does for put() / del() (API version 12):
 *   PUT  https://vercel.com/api/blob/?pathname=<path>   (body = file bytes)
 *   POST https://vercel.com/api/blob/delete              ({ urls })
 * authenticated with the store's read-write token (BLOB_READ_WRITE_TOKEN,
 * set automatically when a Blob store is connected to the Vercel project).
 *
 * Averna uses a PUBLIC store: files are served straight from the Blob CDN, so
 * large audio never passes through a serverless function. Pathnames get a
 * random suffix, so URLs can't be guessed; they are only ever shown to people
 * allowed to see the file.
 *
 * SERVER ONLY.
 */

const API_URL = (process.env.VERCEL_BLOB_API_URL || "https://vercel.com/api/blob").replace(/\/+$/, "");
const API_VERSION = "12";

function token(): string | null {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  return t && t.startsWith("vercel_blob_rw_") ? t : null;
}

/** True when a Blob store is connected (BLOB_READ_WRITE_TOKEN is set). */
export function blobConfigured(): boolean {
  return token() !== null;
}

function storeIdOf(t: string): string {
  // vercel_blob_rw_<storeId>_<secret>
  return t.split("_")[3] ?? "";
}

function access(): "public" | "private" {
  return process.env.BLOB_ACCESS === "private" ? "private" : "public";
}

export class BlobUploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BlobUploadError";
  }
}

function headers(t: string, extra: Record<string, string>): Record<string, string> {
  return {
    authorization: `Bearer ${t}`,
    "x-api-version": API_VERSION,
    "x-vercel-blob-store-id": storeIdOf(t),
    "x-api-blob-request-id": `${storeIdOf(t)}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    "x-api-blob-request-attempt": "0",
    ...extra,
  };
}

export interface PutBlobOptions {
  contentType: string;
  /** Seconds the CDN / browsers may cache the file (default one year: every upload has a unique URL). */
  cacheMaxAge?: number;
  /** Append a random suffix to the pathname (default true). */
  randomSuffix?: boolean;
  signal?: AbortSignal;
}

export interface PutBlobResult {
  url: string;
  downloadUrl: string;
  pathname: string;
}

/** Upload bytes. Throws BlobUploadError on failure (retries once on 5xx / network errors). */
export async function putBlob(
  pathname: string,
  body: Uint8Array | ArrayBuffer | Blob,
  opts: PutBlobOptions
): Promise<PutBlobResult> {
  const t = token();
  if (!t) throw new BlobUploadError("Vercel Blob is not configured (BLOB_READ_WRITE_TOKEN is missing).", 0);
  const clean = pathname.replace(/^\/+/, "").replace(/[#?]/g, "-");
  const url = `${API_URL}/?${new URLSearchParams({ pathname: clean }).toString()}`;
  const init = (attempt: number): RequestInit => ({
    method: "PUT",
    body: body as BodyInit,
    signal: opts.signal,
    headers: {
      ...headers(t, {
        "x-vercel-blob-access": access(),
        "x-content-type": opts.contentType,
        "x-add-random-suffix": opts.randomSuffix === false ? "0" : "1",
        "x-cache-control-max-age": String(opts.cacheMaxAge ?? 31_536_000),
      }),
      "x-api-blob-request-attempt": String(attempt),
    },
  });

  let lastError: BlobUploadError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init(attempt));
    } catch (e) {
      if (opts.signal?.aborted) throw new BlobUploadError("Upload aborted.", 0);
      lastError = new BlobUploadError(`Blob upload failed: ${e instanceof Error ? e.message : "network error"}`, 0);
      continue;
    }
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as Partial<PutBlobResult> | null;
      if (!data?.url) throw new BlobUploadError("Blob upload returned no URL.", res.status);
      return { url: data.url, downloadUrl: data.downloadUrl ?? data.url, pathname: data.pathname ?? clean };
    }
    const text = await res.text().catch(() => "");
    lastError = new BlobUploadError(`Blob upload failed (${res.status}): ${text.slice(0, 300)}`, res.status);
    if (res.status < 500) break; // 4xx: retrying won't help (bad token, quota, access mode …)
  }
  throw lastError ?? new BlobUploadError("Blob upload failed.", 0);
}

/** Delete files by URL. Never throws; returns false on failure. */
export async function deleteBlobs(urls: string[]): Promise<boolean> {
  const t = token();
  const list = urls.filter((u) => typeof u === "string" && u.startsWith("https://"));
  if (!t || list.length === 0) return list.length === 0;
  try {
    for (let i = 0; i < list.length; i += 100) {
      const res = await fetch(`${API_URL}/delete`, {
        method: "POST",
        headers: headers(t, { "content-type": "application/json" }),
        body: JSON.stringify({ urls: list.slice(i, i + 100) }),
      });
      if (!res.ok) return false;
    }
    return true;
  } catch {
    return false;
  }
}
