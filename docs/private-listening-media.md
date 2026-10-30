# Private original Listening media

## Scope

Only browser media URLs change. Existing database papers, accepted answers, recording fingerprints, attempts, grades, Writing and Reading stay unchanged. The registry covers the 64 published supplied Listening papers (58 CDI + 6 Volume 10), their 88 recording rows and 33 referenced diagrams. The private Release also preserves original MP3s for the 13 source papers not yet published; storing audio does not publish a paper.

- 71 CDI full recordings, plus Volume 10's 6 full recordings and 24 verified original clips.
- 44 Listening-only images, including currently unreferenced source maps. No Writing images.
- Immutable GitHub asset IDs, sizes and SHA-256s are pinned in `lib/ielts/audio/private-media.json`. It contains no answer keys, credentials or student data.
- Every supplied CDI full MP3 was matched by SHA-256 to the existing published paper. CDI diagrams match their original content-addressed names; the four Volume 10 diagrams come from the original embedded source images. Old Blob media returned 403 during the migration, so it is not treated as a verification source.

## Delivery

`LISTENING_PRIVATE_MEDIA=on` rewrites only exact registered media URLs to `/api/listening/media/<file>`. The route requires a current authenticated account and applies a per-account request limit. GitHub authorization is server-only (`LISTENING_GITHUB_TOKEN` as a Vercel Secret; prefer a fine-grained Contents: read-only token restricted to this repository).

The server obtains a short-lived signed URL from GitHub and returns a private, no-store 307 redirect. This avoids Vercel's function response-size limit and supports direct byte-range playback. The GitHub credential is never in the browser; the temporary signed asset URL necessarily is, and can be reused until it expires. This is authenticated distribution, not DRM. Signed locations are cached server-side for at most five minutes, with expiry checks and concurrent-request coalescing.

Full practice and Mock use the unchanged complete recording. Changing question parts never restarts that recording. Volume 10 can additionally practise verified original clips individually. Other CDI papers do not offer guessed cuts. Failed originals never fall back to generated/browser voices, and Mock's server deadline keeps running.

## Deployment and rollback

The build guard reads and validates the 64 registered papers, self-grades all 2,560 questions, verifies recording fingerprints and all media mappings, and checks private GitHub access. It does not write to the database. Unregistered future papers retain their existing media behavior.

To revert routing, redeploy with `LISTENING_PRIVATE_MEDIA=off`. Old Blob URLs and database rows have not been deleted, although Blob access may remain restricted. Do not delete old storage until a separate approved retention decision. Rotate/restrict the server token separately from the upload CLI credential.

## Checks

- Unit tests cover authentication, deny-by-default paths, no-store responses, upstream failure, exact URL mapping, immutable fingerprints and answer stripping.
- All 145 remote assets checked: 101 MP3s support 206 byte ranges; all 44 complete image downloads match SHA-256. The 71 newly uploaded CDI files also match their original source bytes in sampled ranges.
- Browser fixtures verify real playback at mobile and desktop widths, question navigation without restart, checking-time transition and no transcript fallback. These do not certify every physical phone or replace an authenticated production acceptance test.
