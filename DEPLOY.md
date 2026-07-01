# Deploying Hearth (single-box)

This is the reference runbook for the **single-box** topology: the app, Postgres,
LiveKit, coturn, and a Caddy TLS proxy on one host. It assumes an operator comfortable
with Docker, DNS, and a firewall. For scale, run LiveKit multi-node with Redis (M9).

## What you need

- A Linux host with a **public IP** and Docker + Compose.
- Two DNS records pointing at the host, e.g. `meet.example.com` and `livekit.example.com`.
- Open ports: **80, 443** (TLS), **7881/tcp** and **7882/udp** (LiveKit media),
  **3478/udp+tcp**, **5349/tcp**, and the coturn relay range (TURN).

## 1. Configure

```bash
cp .env.example .env
```
Set real values in `.env` — at minimum:
- `APP_URL=https://meet.example.com`
- `NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.example.com`
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (also update `livekit/livekit.yaml`)
- `POSTGRES_*` and a strong `DATABASE_URL`
- `TURN_USER` / `TURN_PASSWORD` (also update `coturn/turnserver.conf`)
- Optional: `MAX_PARTICIPANTS`, `WAITING_ROOM_DEFAULT`, `LINK_EXPIRY_HOURS`, `ADMIN_KEY`

Edit `deploy/Caddyfile` with your real domains.

## 2. Harden LiveKit + coturn for production

The dev configs are **not** production-ready. For real deployments:
- `livekit/livekit.yaml`: set `use_external_ip: true`, real `keys`, and configure TURN
  (TLS on 5349) so participants on restrictive networks connect. See LiveKit's deployment
  docs for the media/TURN specifics — that layer is LiveKit's, not reproduced here.
- `coturn/turnserver.conf`: real credentials, and enable TLS with your certs.

## 3. Build, migrate, run

```bash
# Apply DB migrations (from a checkout with Node 22 + deps installed)
npm ci && npm run migrate

# Build + start the full stack
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

Caddy obtains Let's Encrypt certs automatically on first request.

## 4. Verify

- `https://meet.example.com` loads the landing page.
- `https://meet.example.com/api/health` → `{"status":"ok"}` (database + livekit ok).
- `https://meet.example.com/admin?key=<ADMIN_KEY>` shows config + health.
- Create a meeting, open the invite link from another network, confirm A/V connects
  (this exercises the LiveKit media path + TURN).

## 5. Observe

- App logs are structured JSON (one object per line) on stdout — `docker compose logs app`.
- `docker compose ps` for container health (coturn has no HTTP probe; confirm via a real
  call from a restrictive network).

## 6. Update

Pull a new pinned release, then:
```bash
npm run migrate   # apply any new migrations first
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

Image versions (LiveKit, coturn, Postgres, Caddy, Node) are pinned for reproducible
bundles — bump them deliberately.
