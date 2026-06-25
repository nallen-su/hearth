# Hearth — v1 Implementation Plan

**Companion to:** [PRD.md](PRD.md)
**Last updated:** 2026-06-24
**Status:** Draft v1

---

## How to read this

The plan is organized into **milestones (M0–M9)** ordered by dependency. Each milestone is
a **vertical, testable increment** — at the end of each one there is something you can run
and observe, not just code on disk. This suits an incremental Claude Code build: finish a
milestone, verify it in the browser, commit, move on.

- **FR-x** references map back to functional requirements in the PRD for traceability.
- **Effort** is a relative T-shirt size (S / M / L), not a calendar estimate — a solo
  Claude Code build will move much faster than a team but the *relative* weights hold.
- **Verify** is the concrete "done when" check for the milestone.

> **Critical sequencing insight:** M0→M1 is the riskiest stretch. Getting WebRTC media to
> flow end-to-end through self-hosted LiveKit + coturn (NAT traversal, TLS, token auth) is
> where most of the unknowns live. Do M1 as a thin slice *before* building breadth, so the
> hard infra is proven early.

---

## Milestone map

| # | Milestone | Theme | Effort | Depends on |
|---|---|---|---|---|
| M0 | Foundation & local infra | Scaffolding | M | — |
| M1 | Vertical slice: one real call | Prove the media path | M | M0 |
| M2 | Multi-party video & layouts | Conferencing core | L | M1 |
| M3 | Screen sharing | Conferencing core | S | M2 |
| M4 | Chat, reactions & raise hand | Data channel | M | M2 |
| M5 | Rooms & invite links | Meeting management | M | M1 |
| M6 | Waiting room & host controls | Meeting management | L | M5 |
| M7 | Virtual background / blur | Effects | M | M2 |
| M8 | Admin config & operability | Operability | M | M5 |
| M9 | Scale, load test & hardening | Production-ready | L | M2–M8 |

---

## M0 — Foundation & local infrastructure

**Goal:** A running skeleton with all backing services up locally and a CI-able repo.

**Scope**
- Next.js (App Router) + TypeScript project; lint/format/typecheck; base layout & design
  tokens (neutral UI per PRD — no theming).
- `docker-compose.yml` for local dev: **LiveKit** (single node, dev keys), **coturn**,
  **Postgres**. Pin versions.
- Environment/config module (LiveKit URL + API key/secret, Postgres URL, TURN creds).
- DB layer + migration tooling; empty initial schema.
- `/api/health` endpoint + a documented way to check LiveKit/coturn health.

**Deliverables:** runnable repo, `docker compose up` brings up infra, app boots, health
green.

**Verify:** `docker compose up` succeeds; app loads a placeholder page; health endpoint
returns OK; LiveKit dashboard/CLI reachable.

**Effort:** M • **Risk:** medium (coturn + LiveKit config).

---

## M1 — Vertical slice: one real call works

**Goal:** Two browser tabs join the same room and see/hear each other through self-hosted
LiveKit. This proves the entire media path end-to-end.

**Scope** *(FR-3, FR-8, FR-10 partial)*
- **Token-minting API route** using `livekit-server-sdk` (short-lived, room-scoped tokens).
- **Pre-join lobby**: display-name entry, camera/mic preview, device selection, A/V test.
- Join a hardcoded/dev room via `@livekit/components-react`.
- Render local + remote participant video; **mute/unmute mic**, **start/stop camera**.
- Reconnect handling baseline.

**Deliverables:** working 2-party call on `localhost` and across two machines/networks.

**Verify:** Two tabs (and ideally two devices on different networks) join, see and hear
each other, toggle mic/cam; a participant behind NAT connects (coturn relay confirmed).

**Effort:** M • **Risk:** high — **this is the make-or-break infra milestone.** Budget
time for NAT/TURN/TLS debugging.

---

## M2 — Multi-party video & layouts

**Goal:** Rooms scale to many participants with usable layouts.

**Scope** *(FR-6, FR-7, FR-9, FR-10)*
- Responsive **video tile grid** that virtualizes/paginates beyond a threshold (render top
  N active video tracks, not all 100).
- **Active-speaker** detection + speaker view; toggle grid ↔ speaker.
- Status indicators: speaking, muted, poor-connection.
- Enable **simulcast**; adaptive layer selection so large rooms stay performant.
- Full device selection (camera/mic/speaker) wired in.

**Deliverables:** a meeting that stays usable as participant count climbs.

**Verify:** Open 8–10 tabs/clients; grid and speaker views both work; speaking indicator
tracks the active talker; CPU/bandwidth stay sane.

**Effort:** L • **Risk:** medium (perf/virtualization is the tricky part).

---

## M3 — Screen sharing

**Goal:** Participants can present their screen.

**Scope** *(FR-11, FR-12, FR-13)*
- Start/stop **screen/window/tab share** (with system/tab audio where supported).
- Promote active share to the **main stage**; tiles alongside.
- Host can **stop** a participant's share (stubbed until M6 wires host identity).

**Deliverables:** screen share visible to all, prominently staged.

**Verify:** Share a tab with audio; all participants see it staged; stop returns to normal
layout.

**Effort:** S • **Risk:** low (LiveKit handles most of this).

---

## M4 — Chat, reactions & raise hand

**Goal:** Real-time text + lightweight engagement over the data channel.

**Scope** *(FR-14, FR-15, FR-16, FR-17, FR-18)*
- **In-meeting chat** via LiveKit data channel: sender, timestamp, link rendering.
- Chat **ephemeral by default**; persistence flag (writes to Postgres) configurable.
- **Emoji reactions** (transient animations for all).
- **Raise/lower hand**; ordered, host-visible queue.

**Deliverables:** working chat panel, reactions overlay, hand-raise queue.

**Verify:** Messages arrive in real time for all; reactions animate; raised hands appear
in order; ephemeral vs. persisted behaves per config.

**Effort:** M • **Risk:** low.

---

## M5 — Rooms & invite links

**Goal:** The real join model — named rooms and shareable, controllable links.

**Scope** *(FR-1, FR-2, FR-3, FR-4, FR-5)*
- Persist **rooms** and **invite links** in Postgres.
- **Instant ("meet now")** + **named room** creation flows.
- Invite link with optional **expiry** and **revocation**; unguessable tokens.
- Enforce **participant cap** (default 100) at join time.
- Replace M1's hardcoded room with link-driven joins.

**Deliverables:** create a meeting → get a link → others join via link as guests.

**Verify:** Create room, share link, guest joins with only a display name; expired/revoked
links are rejected; cap blocks the N+1 join.

**Effort:** M • **Risk:** low–medium.

---

## M6 — Waiting room & host controls

**Goal:** A host can run an orderly meeting.

**Scope** *(FR-20, FR-21, FR-22, FR-23)*
- **Host identity** model (link creator = host; minimal, pre-accounts).
- **Waiting room**: guests held until **admitted** (individually / admit-all).
- Host actions: **mute participant**, **mute all**, **remove**, **stop screen share**,
  **lower hand**.
- **Lock meeting** (no new joins), **end for all**.
- **Host transfer on host leave** (co-host is a stretch goal).

**Deliverables:** full host control surface + waiting room gate.

**Verify:** Guest waits → host admits; host mutes/removes/locks/ends; host leaving reassigns
host.

**Effort:** L • **Risk:** medium (server-authoritative permission enforcement, not just UI).

---

## M7 — Virtual background / blur

**Goal:** Client-side video effects with graceful fallback.

**Scope** *(FR-19)*
- **Background blur** + **virtual background image** via client-side segmentation
  (MediaPipe Selfie Segmentation or equivalent), applied to the published track.
- Feature **hidden/disabled gracefully** on unsupported/low-power devices.

**Deliverables:** toggle in pre-join lobby and in-meeting.

**Verify:** Blur and image backgrounds work in supported browsers; degrade cleanly
elsewhere; no unacceptable CPU/frame-rate hit.

**Effort:** M • **Risk:** medium (performance on weak devices).

---

## M8 — Admin config & operability

**Goal:** Operators can configure and observe an instance.

**Scope** *(FR-24, FR-25)*
- Env-driven config + a minimal **settings page**: default cap, waiting-room default,
  chat-persistence default, link-expiry default, TURN creds, LiveKit connection.
- **Structured logs**, health checks, documented LiveKit/coturn observability.
- Harden the **single-box** `docker compose` topology for real deployment (TLS via reverse
  proxy/Caddy, domain, public IP guidance).

**Deliverables:** configurable instance + an ops-ready single-box deploy.

**Verify:** Change a default in settings and see it take effect; logs are structured;
single-box deploy works against a real domain + TLS.

**Effort:** M • **Risk:** low–medium.

---

## M9 — Scale, load test & hardening

**Goal:** Hit the 100-participant guarantee and ship-ready quality.

**Scope** *(NFRs: scale, media quality, reliability, accessibility, browser support)*
- **Multi-node** topology: horizontally scaled LiveKit + **Redis** coordination; manifests
  + runbook.
- **Load test** a 100-participant meeting; tune simulcast/layer selection; **pin reference
  hardware sizing** (resolves PRD §12 open question).
- Reconnection/resilience testing; cross-browser pass (Chrome/Edge/Firefox/Safari).
- **Accessibility** pass (keyboard nav, captions-ready structure).
- Delivery: versioned/pinned images + compose/manifests + **ops runbook**.

**Deliverables:** validated 100-participant capability + documented deployment artifacts.

**Verify:** Sustained 100-participant meeting on reference hardware with stable A/V, screen
share, chat, reactions, hand raise; multi-node deploy followed from the runbook.

**Effort:** L • **Risk:** medium–high (real load testing always surprises).

---

## Suggested build order & checkpoints

```
M0 ─► M1 ─►┬─► M2 ─►┬─► M3
           │        ├─► M4
           │        └─► M7
           └─► M5 ─►─── M6
                          │
M2…M8 ───────────────────►└─► M8 ─► M9
```

- **Checkpoint A (after M1):** the bet is de-risked — media flows through self-hosted infra.
  If M1 is painful, address it before building breadth.
- **Checkpoint B (after M2+M3+M4):** you have a *usable conference* (multi-party + screen +
  chat) even before meeting-management polish — good demo moment.
- **Checkpoint C (after M5+M6):** real-world meeting flow (links, waiting room, host
  control) — this is the smallest *credible v1*.
- **Checkpoint D (after M9):** production-ready, scale-validated, deployable v1.

---

## What this plan defers (per PRD §2.2 / §11)

Accounts & SSO/OIDC, recording (LiveKit Egress) & captions, white-labeling, native
desktop/mobile, breakout rooms/polls/whiteboard, PSTN dial-in. None are on the v1 critical
path; the architecture (LiveKit) keeps the door open for recording and identity in v2.

---

## Open risks to watch

1. **NAT traversal / TURN** (M1) — the classic WebRTC self-host trap; prove it early.
2. **100-participant performance** (M2, M9) — virtualization + simulcast tuning + hardware
   sizing must all line up; only a real load test confirms it.
3. **Server-authoritative host controls** (M6) — enforce permissions on the server, never
   trust the client.
4. **Background-effects performance** (M7) on low-end devices — keep the fallback honest.
