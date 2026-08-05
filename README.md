# CYBERTRMX

A mobile-first security operations workspace for cases, authorized scope, public intelligence, evidence, controlled device sessions, and permission-based location check-ins.

## Environments

- Production: `https://drmacze.github.io/cyberxtrmx/`
- Staging: `https://drmacze.github.io/cyberxtrmx/staging/`

Production remains on the verified 5.2.8 interface. The staging branch currently carries **5.3.0-r2**, a safe persistent-job integration candidate.

## 5.3.0-r2 staging candidate

The existing PostgreSQL queue and Edge Function worker are connected through `public/jobs-r2.js` only in staging.

- Lookup requests are written to `cybertrmx-jobs` and return a queue receipt immediately.
- Worker execution continues after the browser closes.
- Queue states include queued, running, retry wait, completed, failed, timed out, cancelled, and dead letter.
- The staging UI exposes queue counts, event history, cancellation, manual retry, and terminal job commands.
- The module does not replace the Supabase client, `window.fetch`, or the Operations API.
- A queue failure remains inside the queue panel and cannot change the main Operations runtime status.
- Production and staging use separate service-worker cache namespaces.
- Deployment is blocked until source contracts and Chromium/WebKit smoke tests pass.

## Current architecture

### Frontend

- Static HTML, CSS, and JavaScript in `public/`
- Installable PWA with isolated production and staging cache namespaces
- Responsive layout for iPhone and desktop
- Terminal, Intel, Monitor, Operations, Profile, Guide, and Patch views
- Contextual terminal command clues
- Protected account form; credentials are not accepted through terminal history
- Security Center for MFA and registered-device controls
- Production Guard diagnostics in Profile and terminal commands

### Production Guard

- Critical interface files are locked to the user-verified production baseline
- Production and staging are deployed to separate paths from separate branches
- Staging carries a visible version marker and `noindex,nofollow`
- System Diagnostics reports cache, service worker, device identity, account session, endpoint, HTTP status, request ID, backend version, duration, and page errors
- Clean Reload replaces only staging service workers and staging caches when used from staging
- Terminal commands: `guard status`, `guard open`, `guard recover`, and `guard staging`
- Pages deployment is blocked when source contracts or browser smoke tests fail

### Connected backend

- Supabase Auth for workspace accounts, session handling, and TOTP authenticator factors
- PostgreSQL for workspaces, members, cases, authorized assets, jobs, events, evidence, check-in requests, location points, devices, idempotency records, rate-limit ledgers, security events, and audit records
- Row-level security and revoked direct browser grants for core operational tables
- Edge Functions as the controlled data path for Operations, persistent jobs, secure check-in submission, and location retrieval
- Session-to-device binding with revocation controls
- Structured API errors and request IDs
- Rate limits for workspace actions and public check-in traffic
- Idempotency records for duplicate-safe write operations
- Persistent queue leases, heartbeats, retry backoff, cancellation, and dead-letter handling

### Provider-backed collection

- DNS inventory through Cloudflare DNS over HTTPS
- Domain and IP registration data through RDAP
- Public IPv4 metadata through `ipwho.is`
- Domain ownership confirmation through a DNS TXT record
- Provider timeouts, normalized events, and evidence receipts with SHA-256 digests

### Location check-in

- Expiring request token
- Request purpose and expiry shown before location access
- Explicit browser permission and final send action
- Multi-sample accuracy refinement
- Duplicate-safe submission key for double taps and connection retries
- Hashed browser metadata instead of raw user-agent storage
- Backend receipt and workspace audit record
- Apple Maps, Google Maps, default map app, and OpenStreetMap actions

## Scope and data boundaries

CYBERTRMX is built for owned assets, authorized reviews, public-source intelligence, and device data shared with clear approval. Phone analysis reports numbering-plan metadata only. It does not identify a private owner or derive a live position from a phone number. External account credentials are never tested, captured, or changed.

## Deployment

GitHub Actions builds one Pages artifact containing production at the root and staging under `/staging/`. Source contracts and Chromium/WebKit smoke tests gate deployment. Backend schema and Edge Functions run in the connected Supabase project.
