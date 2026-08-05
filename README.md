# CYBERTRMX

A mobile-first security operations workspace for cases, authorized scope, public intelligence, evidence, controlled device sessions, and permission-based location check-ins.

## Environments

- Production: `https://drmacze.github.io/cyberxtrmx/`
- Staging: `https://drmacze.github.io/cyberxtrmx/staging/`

Production remains on the verified **5.2.8** interface. The staging branch currently carries **5.3.0-r3**.

## 5.3.0-r3 staging candidate

The PostgreSQL queue and Edge Function worker are connected through isolated staging modules.

- `jobs-r3.js` registers terminal and collection-form capture handlers before the legacy Operations core.
- A valid submission displays `PERSISTENT QUEUE RECEIPT <job-id>` and creates a job with a populated `request_payload`.
- Queue states include queued, running, retry wait, completed, failed, timed out, cancelled, and dead letter.
- Jobs continue after the browser closes through database leases, heartbeats, retry backoff, and the worker cron.
- Nested JSON results are normalized before storage and summarized before display.
- `security-r3.js` coalesces protected read requests, renders TOTP QR data safely, and uses ASCII-safe device headers.
- Historical database-capacity failures are classified as `api.capacity_exhausted` warnings instead of unexplained internal errors.
- A queue failure stays inside the queue panel and cannot change the main Operations runtime status.

## Production Guard

- Critical production interface files remain locked to the user-verified baseline.
- Production and staging use separate paths and cache namespaces.
- Staging carries a visible marker and `noindex,nofollow`.
- System Diagnostics reports build, cache, service worker, device identity, session, endpoint, HTTP status, request ID, backend version, duration, and page errors.
- Clean Reload replaces staging caches without deleting account sessions or workspace data.
- Source contracts and Chromium/WebKit smoke tests gate deployment.

## Connected backend

- Supabase Auth with TOTP MFA and device sessions
- PostgreSQL workspaces, cases, authorized scope, jobs, events, evidence, check-ins, locations, audit, rate limits, and idempotency
- Edge Functions for Operations, persistent jobs, worker execution, check-in, and location receipts
- DNS through Cloudflare DNS over HTTPS
- Domain/IP registration through RDAP
- Public IPv4 enrichment through `ipwho.is`
- Evidence SHA-256 digests and audit history

## Scope and data boundaries

CYBERTRMX is built for owned assets, authorized reviews, public-source intelligence, and device data shared with clear approval. It does not identify a private owner or derive a live position from a phone number. External account credentials are never tested, captured, or changed.

## Deployment

GitHub Actions builds production at the Pages root and staging under `/staging/`. Production remains unchanged until the staging candidate passes device testing and is explicitly promoted.
