# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What this is

**Hearth** — a self-hosted video conferencing app (Zoom/Meet alternative) sold under a
**one-time license**, ONCE-style (https://once.com/). Companies deploy it on their own
cloud; no per-seat SaaS fees, and all media/metadata stays inside the operator's
infrastructure.

**Status:** Building milestone by milestone (see implementation plan). **M0–M5** complete:
foundation; vertical-slice call; multi-party (grid ↔ speaker, active-speaker, centered-grid,
simulcast/adaptive/dynacast); screen share (auto-promoted, audio); chat + emoji reactions +
raise-hand; rooms & invite links (Postgres-backed, unguessable token = join credential,
expiry/revoke enforced, server-side participant cap); waiting room & host controls (host
key in localStorage = host identity; server-authoritative mute/mute-all/remove/stop-share/
lower-hand/lock/end + waiting-room admit/deny via `/api/host`; waiting joiners connect with
no publish/subscribe until admitted); background blur / virtual backgrounds (client-side
MediaPipe via `@livekit/track-processors`, assets served locally — no CDN); admin config
& operability (env-driven meeting defaults + waiting-room default + link expiry; structured
JSON logger; health checks DB + LiveKit; read-only `/admin` status page gated by ADMIN_KEY;
production Dockerfile + Caddy TLS + `DEPLOY.md` single-box runbook); scale & hardening
(multi-node LiveKit + Redis config + `SCALING.md`; reconnect banner via `useConnectionState`;
a11y — Escape/outside-click dismiss + aria on menus; load-test method + sizing guidance).
**M0–M9 complete — v1 feature-complete.** Remaining validation (real 100-participant load
test, cross-browser, hardware pinning) needs live cloud infra — see SCALING.md. Deferred to
v2: chat persistence (FR-16); host-transfer/co-host (FR-23); SSO/accounts; recording.

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
- `npm run setup:effects` — populate `public/mediapipe/` (blur/background assets) locally,
  so nothing loads from a CDN at runtime. Run once after `npm install`.
- `npm run dev` — Next.js dev server on :3000 (app runs on host, not in Docker, during dev).
- `npm run build` / `npm start` — production build / serve (`output: "standalone"`).
- `npm run lint` / `npm run typecheck` — quality gates; run both before declaring done.

Health check: `GET /api/health` → 200 `ok` / 503 `degraded` with per-dependency status.

## Project layout

```
src/
  app/                       # Next.js App Router
    layout.tsx               # root layout
    page.tsx                 # landing: new / join a room
    JoinForm.tsx             # client form (new meeting / join by name)
    globals.css              # neutral design tokens + shared primitives (theming = v2)
    room/[token]/            # [token] is the invite token (the shareable join credential)
      page.tsx               # server: resolves invite token -> room (or invalid-link msg)
      RoomClient.tsx         # client: PreJoin -> LiveKitRoom -> WaitingRoom -> Conference
      WaitingRoom.tsx        # waiting gate (guest holding screen) + host admit indicator
      Conference.tsx         # in-room layout: grid ↔ speaker, screen-share stage, controls
      useHostActions.ts      # client hook -> POST /api/host (server-authoritative)
      CenteredGridLayout.tsx # grid that centers an incomplete last row (LiveKit sizing hooks)
      BackgroundEffects.tsx  # blur / virtual-background control (track-processors, local assets)
      ChatPanel.tsx          # side chat panel (LiveKit Chat prefab; ephemeral in v1)
      Reactions.tsx          # emoji reactions over data channel + floating overlay
      RaiseHand.tsx          # raise-hand via participant attributes; ordered queue
    admin/page.tsx           # read-only operator status page (config + health), ADMIN_KEY-gated
    api/health/route.ts      # liveness/readiness (DB + LiveKit); JSON per-dependency status
    api/rooms/route.ts       # POST: create room (instant/named) + invite link + host key
    api/token/route.ts       # validates invite + cap + lock, mints token (role from host key)
    api/host/route.ts        # POST: host actions (mute/remove/lock/end/…); verifies host key
  lib/
    config.ts                # lazy, validated env config — getConfig(); add new env here
    db.ts                    # lazy Postgres pool — getPool(), pingDatabase()
    livekit.ts               # token minting + host admin actions + counts + pingLiveKit
    rooms.ts                 # rooms/invite-links data access (create/resolve/revoke)
    logger.ts                # structured JSON logger (one line per event) — no secrets
    (room/[token]/useDismiss.ts, useHostActions.ts — client hooks colocated with the route)
scripts/setup-effects.mjs    # bundle MediaPipe assets into public/mediapipe (no CDN)
Dockerfile                   # production app image (standalone); deploy/ has prod compose + Caddy
DEPLOY.md                    # single-box production runbook
SCALING.md                   # multi-node topology, load-test method, sizing (M9)
livekit/livekit.multinode.yaml # LiveKit config with redis (multi-node)
  db/migrations/             # forward-only *.sql, applied lexically by scripts/migrate.ts
scripts/migrate.ts           # dependency-light migration runner
docker-compose.yml           # Postgres + LiveKit + coturn (pinned)
livekit/livekit.yaml         # LiveKit server config (dev)
coturn/turnserver.conf       # TURN config (dev; no TLS)
```

LiveKit notes: build meeting UI from `@livekit/components-react` primitives, scoped per
milestone (don't drop in the all-in-one `<VideoConference>` — it pulls in chat/screen-share
ahead of M3/M4). Client dials `NEXT_PUBLIC_LIVEKIT_URL`; tokens come from `/api/token`.

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
