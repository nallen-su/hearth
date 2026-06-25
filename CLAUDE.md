# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this is

**Hearth** — a self-hosted video conferencing app (Zoom/Meet alternative) sold under a
**one-time license**, ONCE-style (https://once.com/). Companies deploy it on their own
cloud; no per-seat SaaS fees, and all media/metadata stays inside the operator's
infrastructure.

**Status:** Building milestone by milestone (see implementation plan). **M0 (foundation)
complete:** scaffold, local Docker infra, lazy config, DB migration runner, health
endpoint. **Next: M1** — vertical slice of a real LiveKit call.

**Read these first — they are the source of truth:**
- [PRD.md](PRD.md) — product requirements, architecture, scope (and what's explicitly out).
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — milestones M0–M9, build order, risks.

When PRD/plan and this file disagree, the PRD wins — and update this file.

## Tech stack (locked for v1)

- **Frontend:** Next.js (App Router) + React + **TypeScript**.
- **Media:** **LiveKit** (self-hosted SFU, Apache-2.0) — `@livekit/components-react` +
  `livekit-client` on the client, `livekit-server-sdk` on the server.
- **Backend:** Next.js API routes (token minting, rooms/links, admission, host controls).
- **Data:** PostgreSQL. **Redis** only for multi-node LiveKit coordination.
- **NAT traversal:** coturn (STUN/TURN).
- **Packaging:** Docker + Docker Compose (single-box) and multi-node manifests.
- **Target:** web-only, latest Chrome/Edge/Firefox/Safari desktop.

Don't introduce a different framework, an alternate media engine, or a separate standalone
backend without checking in — these are deliberate decisions, not defaults.

## Core domain concepts

- **Room** — a meeting space (instant "meet now" or named). Persisted in Postgres.
- **Invite link** — unguessable, optionally expiring, revocable token that grants join
  access. **Guest links are the only auth in v1** (no accounts/SSO until v2).
- **Host** — the link/room creator; holds meeting controls. Pre-accounts, identity is
  minimal.
- **Token** — short-lived, room-scoped LiveKit access token minted server-side. Never mint
  or expose long-lived or over-scoped tokens; never put the LiveKit API secret on the
  client.

## Hard rules / guardrails

- **Privacy is the product.** No media, chat, or metadata may leave the operator's
  infrastructure. Do not add third-party analytics, telemetry, or phone-home calls.
- **Server-authoritative permissions.** Host controls (mute, remove, admit, lock, cap
  enforcement) must be enforced on the server, never trusted from the client.
- **Secrets via env only.** LiveKit keys, TURN creds, Postgres URL come from environment/
  config — never hardcoded or committed.
- **Stay in v1 scope.** Recording, SSO/accounts, captions, white-labeling, native apps,
  breakout rooms/polls/whiteboard are **deferred** (PRD §2.2 / §11). Don't build them
  without a decision to pull them forward.
- **Pin versions** for LiveKit, coturn, and images — reproducible self-host bundles matter.

## Working conventions

- Build in the **milestone order** from the implementation plan; each milestone is a
  vertical, testable slice. Verify in the browser before moving on.
- Keep changes scoped to the current milestone; reference **FR-x** numbers from the PRD in
  commits/PRs for traceability.
- TypeScript strict; run lint/typecheck before declaring a step done.
- Prefer LiveKit's built-in capabilities (simulcast, active-speaker, data channel) over
  reimplementing them.

## Commands

First-time setup: `cp .env.example .env && npm install`.

- `npm run infra:up` / `infra:down` / `infra:logs` — start/stop/tail Docker services
  (Postgres, LiveKit, coturn) via `docker-compose.yml`.
- `npm run migrate` — apply pending SQL migrations (forward-only runner in `scripts/migrate.ts`).
- `npm run dev` — Next.js dev server on :3000 (app runs on host, not in Docker, during dev).
- `npm run build` / `npm start` — production build / serve (`output: "standalone"`).
- `npm run lint` / `npm run typecheck` — quality gates; run both before declaring done.

Health check: `GET /api/health` → 200 `ok` / 503 `degraded` with per-dependency status.

## Project layout

```
src/
  app/                 # Next.js App Router
    layout.tsx         # root layout
    page.tsx           # landing (placeholder until M1)
    globals.css        # neutral design tokens (theming deferred to v2)
    api/health/route.ts# liveness/readiness endpoint
  lib/
    config.ts          # lazy, validated env config — getConfig(); add new env here
    db.ts              # lazy Postgres pool — getPool(), pingDatabase()
  db/migrations/       # forward-only *.sql, applied lexically by scripts/migrate.ts
scripts/migrate.ts     # dependency-light migration runner
docker-compose.yml     # Postgres + LiveKit + coturn (pinned)
livekit/livekit.yaml   # LiveKit server config (dev)
coturn/turnserver.conf # TURN config (dev; no TLS)
```

Conventions: import via `@/*` alias; keep env access inside `getConfig()` (no `process.env`
reads scattered around); no side effects at module top level (lazy singletons) so
`next build` stays clean.

## Keeping this file current

This file is only useful if it stays true. Treat updating it as part of the work, not a
chore for later. Update it **in the same change** that makes it stale — specifically when:

- **A milestone lands (M0–M9).** Fill in / refresh **Commands** and **Project layout** with
  what's actually there. M0 in particular must replace both stub sections with real content.
- **A new convention is established** (naming, error handling, testing approach, folder
  structure) — record it under Working conventions so it's applied consistently next time.
- **A dependency or tool is added/changed** (new package, migration tool, build step) —
  reflect it in Tech stack and Commands.
- **A decision in PRD/plan changes** (scope pulled forward, stack swap, new guardrail) —
  update the relevant section and keep the "PRD wins" pointer honest.

Keep edits **terse and high-signal** — this file is loaded into context every session, so
every line costs tokens. Document durable rules and pointers, not history or one-off
details (those belong in commits/PRs). If a section is wrong, fix it; if it's obsolete,
delete it. When in doubt, prune.
