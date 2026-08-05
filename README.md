# CYBERTRMX

A mobile-first security operations workspace for cases, authorized scope, public intelligence, evidence, controlled device sessions, and permission-based location check-ins.

## Environments

- Production: `https://drmacze.github.io/cyberxtrmx/`
- Staging: `https://drmacze.github.io/cyberxtrmx/staging/`

Production is sourced from `main`. New frontend work starts on `staging` and is promoted only after contract and browser smoke tests pass.

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
- Staging carries a visible marker and `noindex,nofollow`
- System Diagnostics reports frontend version, environment, cache, service worker, device identity, account session, latest endpoint, HTTP status, request ID, backend version, duration, and page errors
- Clean Reload replaces application service workers and caches without deleting account sessions or workspace data
- Terminal commands: `guard status`, `guard open`, `guard recover`, and `guard staging`
- Pages deployment is blocked when syntax or Production Guard contracts fail
- Chromium and iPhone WebKit smoke tests exercise boot, navigation, Patch, Operations, Profile diagnostics, and backend-failure fallback

### Connected backend

- Supabase Auth for workspace accounts, session handling, and TOTP authenticator factors
- PostgreSQL for workspaces, members, cases, authorized assets, jobs, events, evidence, check-in requests, location points, devices, idempotency records, rate-limit ledgers, security events, and audit records
- Row-level security and revoked direct browser grants for core operational tables
- Edge Functions as the controlled data path for Operations, secure check-in submission, and location retrieval
- Session-to-device binding with revocation controls
- Structured API errors and request IDs
- Rate limits for workspace actions and public check-in traffic
- Idempotency records for duplicate-safe write operations
- API polling instead of direct table subscriptions

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

GitHub Actions builds one Pages artifact containing production at the root and staging under `/staging/`. Source/contract checks gate deployment. Backend schema and Edge Functions run in the connected Supabase project.
