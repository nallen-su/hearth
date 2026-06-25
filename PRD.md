# PRD: Hearth — Self-Hosted Video Conferencing Platform

**Product name:** Hearth
**Author:** Nick Allen
**Last updated:** 2026-06-24
**Status:** Draft v1
**Document type:** Product Requirements Document (MVP / v1)

---

## 1. Summary

A self-hostable video conferencing application that companies buy under a **one-time
license** (modeled on [37signals' ONCE](https://once.com/)) and deploy into their own
cloud environment. It delivers the standard conferencing feature set — multi-party
video, active-speaker layouts, screen sharing, in-meeting chat, and invite links — while
letting the buyer avoid recurring per-seat SaaS fees and keep meeting data inside their
own infrastructure.

The product targets meetings of **50–100+ participants**, which requires a media server
(SFU). To reach that scale on a realistic timeline, v1 is built on **LiveKit**
(Apache-2.0, self-hostable) as the media engine, with a **Next.js + React + TypeScript**
application layer. v1 is **web-only** (no install) and uses **guest invite links** as the
join model, with authenticated accounts and SSO deferred to a later release.

---

## 2. Goals & Non-Goals

### 2.1 Goals (v1)

- Ship a production-quality web app that supports reliable meetings up to **100
  participants**.
- Deliver the core conferencing experience: video tiles + active-speaker view, screen
  share, in-meeting text chat, and shareable invite links.
- Provide host/meeting controls (admit, mute, remove, lock) and a waiting room.
- Support lightweight engagement: **reactions** and **raise hand**.
- Support client-side **virtual background / blur**.
- Be **self-hostable by a company with a competent IT/DevOps team**, with both a simple
  single-box path and a scalable multi-node path.
- Keep all media and meeting data within the operator's own infrastructure.

### 2.2 Non-Goals (v1 — explicitly deferred)

- **Authenticated user accounts & SSO/SAML/OIDC** (planned v2 — see §11).
- **Server-side recording / transcription** (LiveKit Egress; planned v2).
- **Live captions / transcription.**
- **White-labeling / deep theming** (ship a clean neutral UI in v1).
- **Native desktop or mobile apps** (web-only in v1).
- **Polls, breakout rooms, whiteboard.**
- **Telephony / PSTN dial-in.**
- **Federation across separate company instances.**

---

## 3. Background & Strategy

### 3.1 Problem

Per-seat conferencing SaaS (Zoom, Google Meet, Teams) is expensive at scale and routes
meeting media and metadata through a third party. Organizations with privacy, compliance,
or cost constraints want an option they own outright and run themselves.

### 3.2 The ONCE-style model

Like 37signals ONCE, this is **single-purpose software sold once and self-hosted**:

- The buyer pays a one-time fee, receives the software (container images / source bundle),
  and runs it on their own infrastructure.
- We do not host meetings, do not see customer media, and do not charge per-seat or
  per-minute.
- The operator owns their data and uptime.

### 3.3 Operator assumption

The target buyer is expected to **already have infrastructure and a team** capable of
deploying and maintaining a containerized application (TLS, DNS, a TURN server, basic
ops). We therefore optimize for a clean, well-documented deployment rather than a fully
hand-held installer — while still offering a low-friction single-box option for smaller
operators.

---

## 4. Target Users & Personas

| Persona | Role | Needs |
|---|---|---|
| **Operator / IT admin** | Deploys & maintains the instance | Easy, documented deploy; sane defaults; health/observability; minimal ongoing toil. |
| **Host** | Schedules/starts meetings, runs them | Create a meeting, share a link, control participants, screen share, keep the meeting orderly. |
| **Participant (internal)** | Employee joining meetings | Reliable A/V, screen share, chat, low-friction join. |
| **Guest (external)** | Outside invitee | Click a link, join from the browser with no account or install. |

---

## 5. Architecture Overview

```
                         ┌──────────────────────────────────────────┐
                         │              Operator's Cloud              │
                         │                                            │
  Browser (WebRTC) ──────┼──► Next.js App (UI + API routes)           │
  - video/audio          │       - serves SPA                         │
  - screen share         │       - issues LiveKit access tokens       │
  - data channel         │       - meeting/room metadata + chat relay │
        │                │       - host controls / waiting room logic │
        │                │              │                             │
        │  media (SRTP)  │              ▼                             │
        └────────────────┼──► LiveKit SFU (media routing, simulcast)  │
                         │       │                                    │
                         │       ▼                                    │
                         │   TURN/STUN (coturn) for NAT traversal     │
                         │                                            │
                         │   Postgres (rooms, participants, settings) │
                         │   Redis (LiveKit multi-node coordination)  │
                         └──────────────────────────────────────────┘
```

### 5.1 Components

- **Application server — Next.js (React + TypeScript).** Serves the web client, hosts API
  routes for room creation, invite-link generation, **LiveKit access-token minting**,
  waiting-room admission, and host-control actions. Uses the
  `@livekit/components-react` and `livekit-client` SDKs on the front end and
  `livekit-server-sdk` on the back end.
- **Media engine — LiveKit SFU (self-hosted).** Handles WebRTC media routing, **simulcast**
  and **active-speaker detection** so 100-participant rooms stay performant. Shipped as
  part of the bundle.
- **TURN/STUN — coturn.** Required for participants behind restrictive NATs/firewalls.
- **Datastore — PostgreSQL.** Persists rooms, invite links, participant records, host
  settings, and in-meeting chat (chat persistence is optional per meeting).
- **Redis.** Required only for **multi-node** LiveKit deployments (node coordination).

### 5.2 Why LiveKit

- Apache-2.0 and **fully self-hostable** — aligns with the ownership promise of the ONCE
  model; no third-party media dependency at runtime.
- Production-proven at **100+ participants** with simulcast and selective forwarding.
- First-class **React/Next.js SDKs**, which collapses signaling and UI plumbing we would
  otherwise build from scratch.
- Built-in path to future **recording (Egress)**, telephony, and ingest — de-risks the v2
  roadmap.

> Trade-off accepted: we take a dependency on LiveKit's server. Mitigation: it is OSS,
> self-hosted, and pinned to a known-good version in our bundle.

---

## 6. Functional Requirements (v1)

### 6.1 Meetings & invite links

- **FR-1** A host can create a meeting, producing a unique room and a **shareable invite
  link**.
- **FR-2** Invite links can be **instant** (ad-hoc "meet now") or tied to a named room.
- **FR-3** Anyone with a valid invite link can join as a **guest** with only a display
  name — no account, no install (browser only).
- **FR-4** Links support an optional **expiry** and can be **revoked** by the host/operator.
- **FR-5** A meeting enforces a **max participant cap** (configurable; default 100).

### 6.2 In-meeting video & layout

- **FR-6** Render participant **video tiles** in a responsive grid that scales gracefully
  up to the participant cap (paginated/virtualized beyond a threshold, e.g. show top N
  active video tracks).
- **FR-7** **Active-speaker** view that highlights/promotes the current speaker; toggle
  between grid and speaker layouts.
- **FR-8** Per-participant **mute/unmute mic** and **start/stop camera**.
- **FR-9** Visual indicators: speaking, muted, poor-connection, hand-raised.
- **FR-10** Device selection (camera, mic, speaker) and a **pre-join lobby** with A/V
  preview and device test.

### 6.3 Screen sharing

- **FR-11** Any participant (subject to host permission settings) can **share their
  screen / window / tab**, with audio share where the browser supports it.
- **FR-12** Screen share is presented prominently (promoted to the main stage) with
  participant tiles alongside.
- **FR-13** Host can **stop** a participant's screen share.

### 6.4 Chat

- **FR-14** **In-meeting text chat** visible to all participants, delivered over the
  data channel.
- **FR-15** Chat supports basic link rendering and shows sender + timestamp.
- **FR-16** Chat history is available for the duration of the meeting; **persistence
  beyond the meeting is configurable** (default: ephemeral).

### 6.5 Reactions & raise hand

- **FR-17** Participants can send **emoji reactions** that animate transiently for all.
- **FR-18** Participants can **raise/lower hand**; raised hands are visible to the host
  and surfaced in a host-visible queue (ordered).

### 6.6 Virtual background / blur

- **FR-19** Participants can apply **background blur** or a **virtual background image**,
  processed **client-side** (e.g. via MediaPipe/Selfie Segmentation), with a graceful
  fallback (feature hidden) on unsupported/low-power devices.

### 6.7 Waiting room & host controls

- **FR-20** Hosts can enable a **waiting room**; guests land in a holding state until
  **admitted** (individually or all-at-once).
- **FR-21** Host controls: **mute participant**, **mute all**, **remove participant**,
  **stop someone's screen share**, **lower someone's hand**.
- **FR-22** Host can **lock the meeting** (no new joins) and **end the meeting for all**.
- **FR-23** **Host transfer** / co-host designation (at least: reassign host on host
  leave). _Co-host is a stretch goal for v1._

### 6.8 Operator / admin

- **FR-24** A minimal **admin configuration** surface (env-driven + a basic settings page):
  default participant cap, waiting-room default, chat-persistence default, link-expiry
  default, TURN credentials, LiveKit connection.
- **FR-25** **Health endpoints** and structured logs for the app and a documented way to
  observe LiveKit/coturn health.

---

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Scale** | Sustain a single meeting of **100 participants** on documented reference hardware; multiple concurrent meetings bounded by operator's provisioned LiveKit capacity. |
| **Media quality** | Simulcast with adaptive layer selection; target sub-300ms glass-to-glass within a region under normal conditions. |
| **Browser support** | Latest Chrome, Edge, Firefox, Safari (desktop). Mobile browser = best-effort in v1. |
| **Security** | TLS everywhere; WebRTC media encrypted (SRTP/DTLS); short-lived signed LiveKit tokens scoped per room/identity; invite links unguessable + revocable; no media transits any vendor infra. |
| **Privacy / data residency** | All media, chat, and metadata stay within the operator's environment. |
| **Reliability** | Graceful reconnection on transient network loss; participant rejoin without losing meeting state. |
| **Deployability** | Single-host `docker compose up` path for small deployments; documented multi-node path (LiveKit + Redis) for scale. |
| **Observability** | Structured app logs, health checks, and a deployment/ops runbook. |
| **Accessibility** | Keyboard navigable; captions-ready UI structure (captions feature itself is v2). |

---

## 8. Deployment Model

Two supported topologies, both shipped in the bundle:

### 8.1 Single-box (small operators)

- One `docker-compose.yml` brings up: Next.js app, LiveKit (single node), coturn,
  Postgres.
- Operator supplies a domain + TLS cert (documented via reverse proxy / Caddy) and a
  STUN/TURN-reachable public IP.
- Suitable for smaller/occasional meetings.

### 8.2 Multi-node (scale)

- Horizontally scalable LiveKit nodes coordinated via **Redis**; app and Postgres scaled
  per the operator's standard practices.
- Reference deployment notes for a cloud VM/Kubernetes setup.
- Required for sustained large meetings and many concurrent rooms.

**Delivery:** versioned, pinned container images + compose/manifests + an ops runbook.
Updates delivered as new pinned image versions with upgrade notes.

---

## 9. Licensing & Commercial (brief)

Per the ONCE-style intent: a **one-time license** grants the operator the right to deploy
and run the software on their own infrastructure. Delivery is via container images /
source bundle. Detailed mechanics — pricing, license key/activation, update window, and
support tier — are **out of scope for this PRD** and tracked separately. v1 should not
hard-block on a license-enforcement mechanism (can ship honor-system or a lightweight
license-key check; decision deferred).

---

## 10. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript**, `@livekit/components-react`, `livekit-client` |
| Backend | **Next.js API routes** (token minting, room/admission/host-control APIs), `livekit-server-sdk` |
| Media | **LiveKit SFU** (self-hosted) |
| NAT traversal | **coturn** (STUN/TURN) |
| Data | **PostgreSQL** (rooms, links, participants, settings, optional chat) |
| Coordination | **Redis** (multi-node LiveKit only) |
| Video effects | Client-side segmentation (MediaPipe Selfie Segmentation or equivalent) |
| Packaging | **Docker** images + Docker Compose; multi-node manifests |

---

## 11. Roadmap (post-v1)

- **v2 — Identity:** authenticated accounts, **SSO/SAML/OIDC** (Okta, Azure AD, Google
  Workspace), org/role management.
- **v2 — Recording & transcription:** LiveKit **Egress** to operator storage; live
  captions.
- **v2 — White-labeling:** logo, colors, custom domain theming.
- **Later:** breakout rooms, polls, whiteboard, native desktop (Electron/Tauri) and
  mobile apps, PSTN dial-in.

---

## 12. Open Questions

1. **Branding / visual identity** for Hearth (logo, wordmark, palette) — name is set; identity TBD.
2. **License enforcement** mechanism for v1 (honor system vs. license key) — and whether
   any phone-home is acceptable given the privacy positioning (leaning: no phone-home).
3. **Reference hardware sizing** for the 100-participant guarantee (needs a load test to
   pin down LiveKit node specs).
4. **Chat persistence** default and retention policy expectations.
5. **Co-host** in v1 scope or strictly host-transfer-on-leave?
6. **Scheduling**: is "meet now + named rooms" enough for v1, or is a calendar/scheduled-
   meeting concept needed?

---

## 13. Success Criteria (v1)

- A 100-participant meeting runs with stable A/V, screen share, chat, reactions, and hand
  raise on reference hardware.
- An operator with a competent IT team can deploy the single-box topology from the docs
  in **under an hour**, and the multi-node topology by following the runbook.
- A guest can join a meeting from an invite link in a browser with no account and no
  install.
- Host can run an orderly meeting: waiting room, admit, mute, remove, lock, end.
