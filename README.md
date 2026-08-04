# CYBERTRMX

A mobile-first security operations workspace for cases, authorized scope, public intelligence, evidence, controlled device sessions, persistent worker jobs, and permission-based location check-ins.

## Live workspace

`https://drmacze.github.io/cyberxtrmx/`

## Current architecture

### Frontend

- Static HTML, CSS, and JavaScript in `public/`
- Installable PWA with offline shell caching
- Responsive layout for iPhone and desktop
- Terminal, Intel, Monitor, Operations, Profile, Guide, and Patch views
- Contextual terminal command clues
- Protected account form; credentials are not accepted through terminal history
- Security Center for MFA and registered-device controls
- Persistent Job Queue panel with cancel, retry, attempt, heartbeat, and dead-letter status

### Connected backend

- Supabase Auth for workspace accounts, session handling, and TOTP authenticator factors
- PostgreSQL for workspaces, members, cases, authorized assets, durable jobs, events, evidence, check-in requests, location points, devices, idempotency records, rate-limit ledgers, security events, and audit records
- Row-level security and revoked direct browser grants for core operational tables
- Edge Functions as the controlled data path for Operations, persistent job control, worker execution, secure check-in submission, and location retrieval
- Session-to-device binding with revocation controls
- Structured API errors and request IDs
- Rate limits for workspace actions, job control, and public check-in traffic
- Idempotency records for duplicate-safe write operations
- API polling instead of direct table subscriptions

### Real job engine

- `cybertrmx-jobs` validates and enqueues collection work, then immediately returns a durable job ID
- `cybertrmx-worker` claims queued jobs with `FOR UPDATE SKIP LOCKED`
- Worker leases are renewed by heartbeat events and recovered when they expire
- A PostgreSQL cron job invokes the worker every minute for stale-job recovery
- Transient provider failures use exponential retry backoff
- Retry exhaustion moves a job into `dead_letter`
- Queued and running jobs support cancellation
- Failed, timed-out, cancelled, and dead-letter jobs support manual retry
- Job input, attempt counters, timeout settings, worker IDs, lease timestamps, and errors remain in PostgreSQL after the browser closes
- Completed results are committed with evidence and a SHA-256 digest

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

### Quality controls

- JavaScript syntax checks on every push
- Unit tests for device identity, password assessment, SHA-1, and breach-range matching
- Contract tests for PWA caching, device headers, idempotency headers, protected terminal commands, check-in retry safety, persistent queue routing, cancellation, retries, leases, and dead-letter schema
- Product copy and required-asset checks in GitHub Actions

## Scope and data boundaries

CYBERTRMX is built for owned assets, authorized reviews, public-source intelligence, and device data shared with clear approval. Phone analysis reports numbering-plan metadata only. It does not identify a private owner or derive a live position from a phone number. External account credentials are never tested, captured, or changed.

## Deployment

GitHub Actions publishes `public/` to GitHub Pages. Backend schema, PostgreSQL cron, and Edge Functions run in the connected Supabase project.
