# CYBERTRMX

A professional red/black cyber-operations interface built as an **isolated simulation environment**. It includes four application surfaces (Main, CMD, Profile, Monitor), animated telemetry, session logs, deterministic game-account modeling, optional public-data adapters, and coarse public IP metadata lookup.

## Safety model

CYBERTRMX does not perform credential attacks, password guessing, account takeover, private-data extraction, session hijacking, account modification, or device tracking. Any access/password/email/ID result is generated locally as simulation output and cannot alter an external account.

Game profile results expose their source:

- `public-adapter`: returned by a configured public metadata provider.
- `isolated-simulation`: generated inside CYBERTRMX when no authenticated public adapter is available or the adapter fails.

IP inspection returns only public, coarse network metadata such as country/region, ASN, and ISP. It does not reveal a person's identity or exact device location.

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

## Environment variables

See `.env.example`. The Free Fire adapter uses the Free Fire Community API when `FF_API_KEY` is configured. The MLBB adapter is intentionally provider-agnostic and accepts a URL template with `{playerId}` and `{zoneId}` placeholders.

The terminal command reference is intentionally not displayed inside the website UI.

## Deployment

Use any Node.js 20+ host (Render, Railway, Fly.io, a VPS, or a compatible container platform). Set the same environment variables in the hosting dashboard.
