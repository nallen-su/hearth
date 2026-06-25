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

## Local development

Prerequisites: **Node 18.18+**, **Docker** (with Compose).

```bash
# 1. Configure environment (dev defaults provided)
cp .env.example .env

# 2. Install dependencies
npm install

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

Pre-v1, built milestone by milestone (see the implementation plan). **M0 (foundation)**
is in place: project scaffold, local infra, config, DB migration tooling, and a health
endpoint.
