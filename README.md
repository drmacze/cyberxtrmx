# CYBERTRMX

A mobile-first security operations workspace for cases, authorized scope, public intelligence, evidence, controlled device sessions, and permission-based location check-ins.

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

### Quality controls

- JavaScript syntax checks on every push
- Unit tests for device identity, password assessment, SHA-1, and breach-range matching
- Contract tests for PWA caching, device headers, idempotency headers, protected terminal commands, and check-in retry safety
- Product copy and required-asset checks in GitHub Actions

## Scope and data boundaries

CYBERTRMX is built for owned assets, authorized reviews, public-source intelligence, and device data shared with clear approval. Phone analysis reports numbering-plan metadata only. It does not identify a private owner or derive a live position from a phone number. External account credentials are never tested, captured, or changed.

## Deployment

GitHub Actions publishes `public/` to GitHub Pages. Backend schema and Edge Functions run in the connected Supabase project.
