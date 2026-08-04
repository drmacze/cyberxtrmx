# CYBERTRMX Supabase backend

## Deployed functions

- `cybertrmx-ops` — authenticated Operations and security API, version `ops-v5.2-secure.1`
- `cybertrmx-jobs` — authenticated persistent queue and job-control API, version `jobs-v5.3.0`
- `cybertrmx-worker` — secret-authenticated lease worker, version `worker-v5.3.0`
- `cybertrmx-checkin` — token-authenticated public check-in endpoint, version `checkin-v5.2-secure`
- `cybertrmx-locations` — authenticated location receipt endpoint, version `locations-v5.2-secure`

## Security contract

- Core operational tables are not readable directly by `anon` or `authenticated` roles.
- Edge Functions are the controlled data path.
- Every authenticated API response includes a request ID.
- Browser sessions are bound to a generated device ID.
- Accounts with a verified MFA factor must present an AAL2 token before backend data access.
- Write operations use idempotency keys.
- Public check-in submissions use a stable submission key to prevent duplicate points.
- Workspace, job-control, and public check-in endpoints use database-backed rate limits.
- Raw IP addresses and raw user-agent values are not stored in the security ledgers.
- The worker endpoint does not accept browser JWTs; it requires a random secret stored in the private database schema.

## Persistent job engine

- `cybertrmx-jobs` validates a collection request, stores it in PostgreSQL, and returns HTTP 202 with a durable job ID.
- `cybertrmx-worker` claims work with `FOR UPDATE SKIP LOCKED`.
- A claimed job receives a renewable lease and heartbeat timestamps.
- Expired leases are recovered into retry, cancellation, or dead-letter states.
- Transient provider failures use exponential retry backoff.
- Retry exhaustion moves the job into `dead_letter`.
- Running jobs check cancellation requests at worker checkpoints.
- Completed results are inserted into evidence with a SHA-256 digest in the same controlled completion path.
- PostgreSQL cron invokes the worker every minute, while enqueue and retry operations also trigger it immediately through `pg_net`.

## Migrations

- `20260804183240_cybertrmx_v52_security_foundation.sql`
- `20260804190040_cybertrmx_v52_linter_hardening.sql`
- `20260804200000_cybertrmx_v53_real_job_engine.sql`
- `20260804200600_cybertrmx_v53_monotonic_job_events.sql`

## Dashboard setting

Supabase Auth native leaked-password protection should also be enabled in the project dashboard. The frontend performs a Have I Been Pwned Passwords k-anonymity check before account creation, but the native Auth setting remains an additional recommended control.
