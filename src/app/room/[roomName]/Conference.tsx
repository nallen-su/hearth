"use client";

import { useMemo, useState } from "react";
import {
  CarouselLayout,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  MediaDeviceMenu,
  ParticipantTile,
  RoomAudioRenderer,
  useParticipants,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

type View = "grid" | "speaker";

/**
 * In-room layout (M2). Grid ↔ speaker toggle; speaker view auto-follows the active
 * speaker and lets you click a thumbnail to pin someone. ParticipantTile renders the
 * speaking ring, mute, and connection-quality indicators on its own.
 *
 * Screen share (M3) and chat (M4) are intentionally absent — the camera-only track
 * source and the scoped ControlBar keep this milestone's surface area honest.
 */
export default function Conference({ roomName }: { roomName: string }) {
  const [view, setView] = useState<View>("grid");
  const [pinnedSid, setPinnedSid] = useState<string | null>(null);

  // withPlaceholder keeps a tile for camera-off participants; GridLayout paginates
  // automatically once tiles exceed what fits, so 100-person rooms stay bounded.
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });

  const participants = useParticipants();
  const speaking = useSpeakingParticipants(); // loudest first; empty when silent

  // Who's on the main stage in speaker view: a manual pin wins, else the active
  // speaker, else the first participant.
  const focusSid = useMemo(() => {
    if (view !== "speaker") return null;
    if (pinnedSid && participants.some((p) => p.sid === pinnedSid)) return pinnedSid;
    if (speaking.length > 0) return speaking[0]!.sid;
    return participants[0]?.sid ?? null;
  }, [view, pinnedSid, speaking, participants]);

  const focusTrack = focusSid ? tracks.find((t) => t.participant.sid === focusSid) : undefined;
  const carouselTracks = focusSid
    ? tracks.filter((t) => t.participant.sid !== focusSid)
    : tracks;

  const isPinned = view === "speaker" && pinnedSid !== null;

  return (
    <div className="room-shell">
      <header className="room-topbar">
        <span>
          <strong>{participants.length}</strong> in “
          <span style={{ color: "var(--color-accent)" }}>{roomName}</span>”
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {isPinned && (
            <button className="link-btn" onClick={() => setPinnedSid(null)}>
              Pinned — follow speaker
            </button>
          )}
          <div className="view-toggle" role="group" aria-label="Layout">
            <button aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              Grid
            </button>
            <button aria-pressed={view === "speaker"} onClick={() => setView("speaker")}>
              Speaker
            </button>
          </div>
        </div>
      </header>

      <div className="room-body">
        {view === "grid" || !focusTrack ? (
          <GridLayout tracks={tracks} style={{ height: "100%" }}>
            <ParticipantTile />
          </GridLayout>
        ) : (
          <FocusLayoutContainer style={{ height: "100%" }}>
            <CarouselLayout tracks={carouselTracks}>
              <ParticipantTile
                onParticipantClick={(e) => e.participant && setPinnedSid(e.participant.sid)}
              />
            </CarouselLayout>
            <FocusLayout trackRef={focusTrack} />
          </FocusLayoutContainer>
        )}
      </div>

      <div className="room-controls">
        {/* M1/M2 scope: mic, camera (each with a device picker via the chevron), leave. */}
        <ControlBar
          controls={{ microphone: true, camera: true, screenShare: false, chat: false, leave: true }}
        />
        <label className="speaker-select">
          <span>Speaker</span>
          <MediaDeviceMenu kind="audiooutput" />
        </label>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}
