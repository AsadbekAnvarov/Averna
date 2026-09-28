/**
 * Run best-effort work after the response has been sent.
 *
 * On Vercel this registers the promise with the platform's `waitUntil` — the
 * same request context `@vercel/functions` reads (Symbol.for
 * "@vercel/request-context"), without adding that dependency — so the function
 * stays alive until the work settles (within its maxDuration). Elsewhere (local
 * dev, tests) the promise simply runs on. Errors are always caught and logged;
 * this never throws and never delays the caller.
 *
 * SERVER ONLY.
 */

const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

type RequestContext = { waitUntil?: (promise: Promise<unknown>) => void };

function requestContext(): RequestContext {
  try {
    const g = globalThis as typeof globalThis & { [REQUEST_CONTEXT]?: { get?: () => RequestContext | undefined } };
    return g[REQUEST_CONTEXT]?.get?.() ?? {};
  } catch {
    return {};
  }
}

/** True when the platform keeps the function alive for work started after the response. */
export function canRunAfterResponse(): boolean {
  return typeof requestContext().waitUntil === "function";
}

/**
 * Start `work` now without awaiting it. `label` names it in the error log.
 * Returns the (never-rejecting) promise, for tests.
 */
export function runAfterResponse(label: string, work: () => Promise<unknown>): Promise<void> {
  const p: Promise<void> = Promise.resolve()
    .then(work)
    .then(
      () => undefined,
      (e: unknown) => {
        console.error(`${label} failed:`, e);
      }
    );
  try {
    requestContext().waitUntil?.(p);
  } catch {
    // Not on Vercel, or the request context is gone — the promise runs on regardless.
  }
  return p;
}
