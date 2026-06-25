"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CarouselLayout,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  MediaDeviceMenu,
  RoomAudioRenderer,
  useChat,
  useParticipants,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import { isEqualTrackRef } from "@livekit/components-core";
import { Track } from "livekit-client";
import CenteredGridLayout from "./CenteredGridLayout";
import HandTile from "./HandTile";
import ChatPanel from "./ChatPanel";
import { ReactionBar, ReactionsOverlay, useReactions } from "./Reactions";
import { RaiseHandButton, RaisedHandsIndicator, useRaisedHands } from "./RaiseHand";

type View = "grid" | "speaker";

/**
 * In-room layout. Grid ↔ speaker toggle; speaker view auto-follows the active speaker
 * and lets you click a thumbnail to pin someone. A screen share (M3) auto-promotes to
 * the main stage. Chat, reactions, and raise-hand (M4) ride the data channel /
 * participant attributes. ParticipantTile renders speaking/mute/connection indicators.
 *
 * Host-side "stop someone's share" (FR-13) and chat persistence (FR-16) are deferred to
 * M6 and M5 respectively.
 */
export default function Conference({ roomName }: { roomName: string }) {
  const [view, setView] = useState<View>("grid");
  const [pinnedSid, setPinnedSid] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const { reactions, sendReaction } = useReactions();
  const raisedHands = useRaisedHands();
  const raisedIdentities = useMemo(
    () => new Set(raisedHands.map((h) => h.identity)),
    [raisedHands],
  );

  // Unread chat badge: useChat shares the room's message buffer with the Chat prefab.
  const { chatMessages } = useChat();
  const [seenCount, setSeenCount] = useState(0);
  useEffect(() => {
    if (chatOpen) setSeenCount(chatMessages.length);
  }, [chatOpen, chatMessages.length]);
  const unread = chatOpen ? 0 : Math.max(0, chatMessages.length - seenCount);

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
  const speaking = useSpeakingParticipants();

  const speakerFocusSid = useMemo(() => {
    if (view !== "speaker") return null;
    if (pinnedSid && participants.some((p) => p.sid === pinnedSid)) return pinnedSid;
    if (speaking.length > 0) return speaking[0]!.sid;
    return participants[0]?.sid ?? null;
  }, [view, pinnedSid, speaking, participants]);

  const speakerFocusTrack = speakerFocusSid
    ? cameraTracks.find((t) => t.participant.sid === speakerFocusSid)
    : undefined;

  // A screen share always takes the main stage; otherwise speaker view's focus.
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
          <RaisedHandsIndicator raised={raisedHands} />
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

      <div className="room-content">
        <div className="room-main">
          {!focusTrack ? (
            <CenteredGridLayout tracks={cameraTracks} raisedIdentities={raisedIdentities} />
          ) : (
            <FocusLayoutContainer style={{ height: "100%" }}>
              <CarouselLayout tracks={carouselTracks}>
                <HandTile
                  raisedIdentities={raisedIdentities}
                  onParticipantClick={(e) => e.participant && setPinnedSid(e.participant.sid)}
                />
              </CarouselLayout>
              <FocusLayout trackRef={focusTrack} />
            </FocusLayoutContainer>
          )}
          <ReactionsOverlay reactions={reactions} />
        </div>

        {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      </div>

      <div className="room-controls">
        {/* Screen share captures tab/system audio by default. Chat lives in our own
            panel below, so the ControlBar's chat button stays off. */}
        <ControlBar
          controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true }}
        />
        <ReactionBar onReact={sendReaction} />
        <RaiseHandButton raised={raisedHands} />
        <button
          className={`ctrl-btn${chatOpen ? " active" : ""}`}
          aria-pressed={chatOpen}
          onClick={() => setChatOpen((o) => !o)}
        >
          💬 Chat
          {unread > 0 && <span className="unread-badge">{unread}</span>}
        </button>
        <label className="speaker-select">
          <span>Speaker</span>
          <MediaDeviceMenu kind="audiooutput" />
        </label>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}
