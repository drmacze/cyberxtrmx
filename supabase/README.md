# CYBERTRMX Supabase backend

## Deployed functions

- `cybertrmx-ops` — authenticated Operations API, version `ops-v5.2-secure.1`
- `cybertrmx-checkin` — token-authenticated public check-in endpoint, version `checkin-v5.2-secure`
- `cybertrmx-locations` — authenticated location receipt endpoint, version `locations-v5.2-secure`

## 5.2 security contract

- Core operational tables are not readable directly by `anon` or `authenticated` roles.
- Edge Functions are the controlled data path.
- Every Operations response includes a request ID.
- Browser sessions are bound to a generated device ID.
- Accounts with a verified MFA factor must present an AAL2 token before backend data access.
- Write operations use idempotency keys.
- Public check-in submissions use a stable submission key to prevent duplicate points.
- Workspace and public check-in endpoints use database-backed rate limits.
- Raw IP addresses and raw user-agent values are not stored in the 5.2 security ledgers.

## Migrations

- `20260804183240_cybertrmx_v52_security_foundation.sql`
- `20260804190040_cybertrmx_v52_linter_hardening.sql`

## Dashboard setting

Supabase Auth native leaked-password protection should also be enabled in the project dashboard. The frontend currently performs a Have I Been Pwned Passwords k-anonymity check before account creation, but the native Auth setting remains an additional recommended control.
