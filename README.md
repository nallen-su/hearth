# Hearth

Self-hosted video conferencing (Zoom/Meet alternative) sold under a one-time license,
ONCE-style. Companies deploy it on their own cloud; no per-seat fees, and all media and
metadata stays inside the operator's infrastructure.

- **Product spec:** [PRD.md](PRD.md)
- **Build plan:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- **Agent/dev guide:** [CLAUDE.md](CLAUDE.md)

## Stack

Next.js (App Router) + React + TypeScript · LiveKit (self-hosted SFU) · PostgreSQL ·
coturn (TURN) · Docker Compose. Web-only for v1.

## Features so far (M0–M4)

- **Multi-party calls** over a self-hosted LiveKit SFU, with simulcast, adaptive stream,
  and dynacast for scale.
- **Pre-join lobby** — display name, camera/mic preview, and device selection.
- **Layouts** — responsive grid (centers an incomplete last row, paginates large rooms)
  and a speaker view that follows the active speaker; click a tile to pin.
- **Screen sharing** with tab/system audio, auto-promoted to the main stage.
- **Chat** (ephemeral), **emoji reactions**, and **raise hand** with an ordered queue and
  a per-tile badge.
- **Background blur / virtual backgrounds** (client-side, MediaPipe), with all assets
  served locally — no third-party CDN.
- **In-call device switching** (camera / mic / speaker) and a room pill with the attendee
  roster + copy-link.
- **Guest join** via a room link — no account needed.

Targets latest Chrome / Edge / Firefox / Safari (desktop).

## Local development

Prerequisites: **Node 22 LTS** (see `.nvmrc` — run `nvm use`), **Docker** (with Compose).

```bash
# 1. Configure environment (dev defaults provided)
cp .env.example .env

# 2. Install dependencies
npm install

# 2b. Fetch background-effects assets locally (blur/virtual backgrounds).
#     One-time; keeps MediaPipe assets on your own origin, never a CDN.
npm run setup:effects

# 3. Start backing services (Postgres, LiveKit, coturn)
npm run infra:up

# 4. Apply database migrations
npm run migrate

# 5. Run the app
npm run dev
```

Then open http://localhost:3000. Check service health at
http://localhost:3000/api/health.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run migrate` | Apply pending SQL migrations |
| `npm run infra:up` / `infra:down` | Start / stop Docker services |
| `npm run infra:logs` | Tail service logs |

## Project status

**v1 feature-complete (M0–M9).** Foundation & infra; a working LiveKit call; multi-party
layouts; screen sharing; chat/reactions/raise-hand; rooms & invite links; waiting room &
host controls; background blur / virtual backgrounds; admin config & operability;
multi-node scaling config. Production deploy: [DEPLOY.md](DEPLOY.md) (single-box) and
[SCALING.md](SCALING.md) (multi-node + load testing). Remaining before GA: a real
100-participant load test and cross-browser validation on live infra (see SCALING.md).
Deferred to v2: SSO/accounts, recording, chat persistence.

### Testing a call across machines

For same-machine testing, two browser tabs/profiles work out of the box. To try a call
from another device (e.g. on your LAN), set `rtc.node_ip` in `livekit/livekit.yaml` to
your machine's LAN IP and restart LiveKit (`docker compose restart livekit`) — otherwise
the SFU advertises `127.0.0.1`, which only the local machine can reach. Browsers also
require HTTPS for camera/mic access on any non-`localhost` origin.
