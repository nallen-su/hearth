"use client";

import { useMemo, useState } from "react";
import {
  CarouselLayout,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  MediaDeviceMenu,
  ParticipantTile,
  RoomAudioRenderer,
  useParticipants,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import { isEqualTrackRef } from "@livekit/components-core";
import { Track } from "livekit-client";
import CenteredGridLayout from "./CenteredGridLayout";

type View = "grid" | "speaker";

/**
 * In-room layout. Grid ↔ speaker toggle; speaker view auto-follows the active speaker
 * and lets you click a thumbnail to pin someone. A screen share (M3) auto-promotes to
 * the main stage over everything else. ParticipantTile renders the speaking ring, mute,
 * and connection-quality indicators on its own.
 *
 * Chat (M4) is intentionally absent. Host-side "stop someone's share" (FR-13) lands with
 * host controls in M6; for now a sharer stops their own share from the control bar.
 */
export default function Conference({ roomName }: { roomName: string }) {
  const [view, setView] = useState<View>("grid");
  const [pinnedSid, setPinnedSid] = useState<string | null>(null);

  // withPlaceholder keeps a tile for camera-off participants; screen shares are picked
  // up here too so they can be promoted to the stage.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);
  const screenShareTrack = tracks.find((t) => t.source === Track.Source.ScreenShare);

  const participants = useParticipants();
  const speaking = useSpeakingParticipants(); // loudest first; empty when silent

  // Speaker-view focus: a manual pin wins, else the active speaker, else first person.
  const speakerFocusSid = useMemo(() => {
    if (view !== "speaker") return null;
    if (pinnedSid && participants.some((p) => p.sid === pinnedSid)) return pinnedSid;
    if (speaking.length > 0) return speaking[0]!.sid;
    return participants[0]?.sid ?? null;
  }, [view, pinnedSid, speaking, participants]);

  const speakerFocusTrack = speakerFocusSid
    ? cameraTracks.find((t) => t.participant.sid === speakerFocusSid)
    : undefined;

  // A screen share always takes the main stage (FR-12); otherwise it's speaker view's
  // focus (or nothing, in grid view).
  const focusTrack = screenShareTrack ?? speakerFocusTrack;
  const carouselTracks = focusTrack
    ? tracks.filter((t) => !isEqualTrackRef(t, focusTrack))
    : [];

  const isPinned = view === "speaker" && pinnedSid !== null && !screenShareTrack;

  return (
    <div className="room-shell">
      <header className="room-topbar">
        <span>
          <strong>{participants.length}</strong> in “
          <span style={{ color: "var(--color-accent)" }}>{roomName}</span>”
          {screenShareTrack && <span className="share-badge">● Screen sharing</span>}
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
        {!focusTrack ? (
          <CenteredGridLayout tracks={cameraTracks} />
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
        {/* Screen share captures tab/system audio by default (ControlBar capture opts).
            Chat stays off until M4. */}
        <ControlBar
          controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true }}
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
