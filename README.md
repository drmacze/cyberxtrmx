# CYBERTRMX

A mobile-first security operations workspace for cases, authorized scope, public intelligence, evidence, live job events, and permission-based location check-ins.

## Live workspace

`https://drmacze.github.io/cyberxtrmx/`

## Current architecture

### Frontend

- Static HTML, CSS, and JavaScript in `public/`
- Installable PWA with offline shell caching
- Responsive layout for iPhone and desktop
- Terminal, Intel, Monitor, Operations, Profile, Guide, and Patch views
- Local terminal state for case-oriented training workflows

### Connected backend

- Supabase Auth for workspace accounts and session handling
- PostgreSQL for workspaces, members, cases, authorized assets, jobs, events, evidence, check-in requests, location points, and audit records
- Row-level security for workspace data isolation
- Realtime updates for jobs, job events, check-in status, and received location points
- Edge Functions for the operation API, secure check-in submission, and location retrieval

### Provider-backed collection

- DNS inventory through Cloudflare DNS over HTTPS
- Domain and IP registration data through RDAP
- Public IPv4 metadata through `ipwho.is`
- Domain ownership confirmation through a DNS TXT record
- Evidence receipts with SHA-256 digests

### Location check-in

- Expiring random token per request
- Request purpose and expiry shown before location access
- Explicit browser permission and final send action
- Multi-sample accuracy refinement
- Backend receipt and workspace audit record
- Apple Maps, Google Maps, default map app, and OpenStreetMap actions

## Scope and data boundaries

CYBERTRMX is built for owned assets, authorized reviews, public-source intelligence, and device data shared with clear approval. Phone analysis reports numbering-plan metadata only. It does not identify a private owner or derive a live position from a phone number. External account credentials are never tested, captured, or changed.

## Deployment

GitHub Actions publishes `public/` to GitHub Pages. Backend schema and Edge Functions run in the connected Supabase project.
