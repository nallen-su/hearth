# Scaling Hearth (M9)

The single-box topology (see [DEPLOY.md](DEPLOY.md)) is fine for small/occasional
meetings. For sustained large meetings (the 50–100+ target) and many concurrent rooms,
run **LiveKit multi-node with Redis** and load-test to pin your hardware.

## Multi-node topology

```
                         ┌─────────── Redis (shared routing state) ───────────┐
                         │                                                    │
   browsers ── wss ──► LiveKit node A (public IP A)   LiveKit node B (public IP B)  …
                         ▲  media (UDP) direct to the node hosting the room     ▲
   browsers ── https ─► Hearth app (stateless; scale behind a normal LB) ───────┘
                                    │
                              Postgres (rooms/links/host state)
```

- **Redis** lets any node handle any room; add `redis:` to the LiveKit config
  ([livekit/livekit.multinode.yaml](livekit/livekit.multinode.yaml)). All nodes share one
  Redis and the same API key/secret.
- Each **LiveKit node** needs its **own routable public IP** — media goes directly to the
  node, so nodes are *not* interchangeable behind a plain HTTP load balancer. Clients reach
  a node via the signaling URL; LiveKit + Redis route them to the right node.
- The **Hearth app** is stateless (state lives in Postgres/LiveKit) — scale it behind a
  normal load balancer. Postgres and Redis are scaled per your standard practice.

## Load testing (before you trust a number)

LiveKit ships a load tester — simulate participants without real browsers:

```bash
# Install the CLI (see github.com/livekit/livekit-cli), then, against your deployment:
livekit-cli load-test \
  --url wss://livekit.example.com \
  --api-key <key> --api-secret <secret> \
  --room loadtest --video-publishers 100 --subscribers 100
```

Watch CPU, memory, and egress bandwidth on the LiveKit node(s) while it ramps. That tells
you what a single node sustains and where you need to add nodes.

## Reference hardware sizing

Pin real numbers from **your** load test — the figures below are only a starting point to
provision from, not a guarantee (PRD §12). A rough starting point for a single LiveKit
node targeting a ~100-participant room with simulcast:

- **4–8 vCPU, 8–16 GB RAM**, and generous **egress bandwidth** (a 100-person grid fans out
  a lot of video — bandwidth, not CPU, is usually the first ceiling).
- Simulcast layers are already tuned in the client (180p/360p/720p) so the SFU forwards
  the smallest layer that fits each viewer's tile; `adaptiveStream` + `dynacast` cut
  unwatched layers.

Re-measure after any client media change.

## Resilience & reconnection

- LiveKit auto-reconnects on transient network loss; the app shows a **"Reconnecting…"**
  banner (driven by `useConnectionState`) and restores the session without a rejoin.
- coturn (TURN) must be reachable with TLS so participants on restrictive networks fall
  back to relay. Validate by joining from a locked-down network.

## Cross-browser & accessibility

- Target: latest **Chrome, Edge, Firefox, Safari** (desktop). Verify a real call + screen
  share + background effects in each; effects auto-hide where unsupported.
- Menus/popovers close on **Escape** and outside-click and expose `aria-haspopup` /
  `aria-expanded`; controls are native buttons (keyboard-operable). The reconnect banner
  is an `aria-live` region.

## Delivery

Ship pinned images (LiveKit, coturn, Postgres, Redis, Caddy, Node) so bundles are
reproducible; bump versions deliberately. Multi-node manifests derive from
[deploy/docker-compose.prod.yml](deploy/docker-compose.prod.yml) + the multi-node LiveKit
config above.
