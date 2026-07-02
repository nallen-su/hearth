"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CarouselLayout,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  MediaDeviceMenu,
  RoomAudioRenderer,
  useChat,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomInfo,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import { isEqualTrackRef } from "@livekit/components-core";
import { ConnectionState, Track } from "livekit-client";
import CenteredGridLayout from "./CenteredGridLayout";
import HandTile from "./HandTile";
import RoomPill from "./RoomPill";
import ChatPanel from "./ChatPanel";
import { ReactionBar, ReactionsOverlay, useReactions } from "./Reactions";
import { BackgroundEffectsButton } from "./BackgroundEffects";
import { RaiseHandButton, RaisedHandsIndicator, useRaisedHands } from "./RaiseHand";
import { WaitingHostIndicator } from "./WaitingRoom";
import { useHostActions } from "./useHostActions";

/** Read a participant's role from metadata ({"role": ...}). */
function roleOf(metadata: string | undefined): string {
  try {
    return JSON.parse(metadata || "{}").role ?? "guest";
  } catch {
    return "guest";
  }
}

type View = "grid" | "speaker";

/**
 * In-room layout. Grid ↔ speaker toggle; speaker view auto-follows the active speaker
 * and lets you click a thumbnail to pin someone. Screen share (M3) auto-promotes to the
 * main stage. Chat, reactions, raise-hand (M4) ride the data channel / attributes.
 *
 * Host controls (M6): meeting-level (mute-all, lock, end) live in the topbar host bar;
 * per-participant (mute, lower hand, stop share, remove) live in the attendee dropdown.
 * All are enforced server-side via the host key — the UI is just the trigger.
 */
export default function Conference({
  roomName,
  inviteToken,
  hostKey,
  isHost,
  initialLocked,
  initialWaitingEnabled,
}: {
  roomName: string;
  inviteToken: string;
  hostKey: string | null;
  isHost: boolean;
  initialLocked: boolean;
  initialWaitingEnabled: boolean;
}) {
  const [view, setView] = useState<View>("grid");
  const [pinnedSid, setPinnedSid] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const { localParticipant } = useLocalParticipant();
  const host = useHostActions(inviteToken, hostKey);
  const connectionState = useConnectionState();

  const { reactions, sendReaction } = useReactions();
  const raisedHands = useRaisedHands();
  const raisedIdentities = useMemo(
    () => new Set(raisedHands.map((h) => h.identity)),
    [raisedHands],
  );

  // Host "lower hand" command, sent to a single participant; the target clears its own
  // hand attribute on receipt (only the participant — or an admin — can change it).
  const { send: sendHostCmd } = useDataChannel("host_cmd", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data?.type === "lower_hand") {
        void localParticipant.setAttributes({
          ...localParticipant.attributes,
          hand_raised: "",
        });
      }
    } catch {
      /* ignore malformed command */
    }
  });
  const lowerHand = useCallback(
    (identity: string) => {
      void sendHostCmd(new TextEncoder().encode(JSON.stringify({ type: "lower_hand" })), {
        reliable: true,
        destinationIdentities: [identity],
      });
    },
    [sendHostCmd],
  );

  // Lock + waiting-room state live in LiveKit room metadata once a host action writes it,
  // so changes propagate to every client. Until then (e.g. a meeting created with the
  // waiting room already on) we fall back to the initial flags from the token response.
  const roomInfo = useRoomInfo();
  const { locked, waitingEnabled } = useMemo(() => {
    let m: Record<string, unknown> = {};
    try {
      m = JSON.parse(roomInfo.metadata || "{}");
    } catch {
      /* no metadata yet */
    }
    return {
      locked: "locked" in m ? Boolean(m.locked) : initialLocked,
      waitingEnabled: "waitingEnabled" in m ? Boolean(m.waitingEnabled) : initialWaitingEnabled,
    };
  }, [roomInfo.metadata, initialLocked, initialWaitingEnabled]);

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

  // Hide participants still in the waiting room: they're connected (so the host can
  // admit them) but have no published tracks, so withPlaceholder would otherwise show
  // them an empty tile. Re-evaluated on metadata change via useParticipants below.
  const visibleTracks = tracks.filter((t) => roleOf(t.participant.metadata) !== "waiting");
  const cameraTracks = visibleTracks.filter((t) => t.source === Track.Source.Camera);
  const screenShareTrack = visibleTracks.find((t) => t.source === Track.Source.ScreenShare);
  const sharingIdentity = screenShareTrack?.participant.identity ?? null;

  const participants = useParticipants();
  const speaking = useSpeakingParticipants();

  // People held in the waiting room (host admits them). useParticipants re-renders on
  // metadata changes, so this updates as people arrive and get admitted.
  const waitingParticipants = useMemo(
    () =>
      participants
        .filter((p) => roleOf(p.metadata) === "waiting")
        .map((p) => ({ identity: p.identity, name: p.name || p.identity })),
    [participants],
  );

  const speakerFocusSid = useMemo(() => {
    if (view !== "speaker") return null;
    if (pinnedSid && participants.some((p) => p.sid === pinnedSid)) return pinnedSid;
    if (speaking.length > 0) return speaking[0]!.sid;
    return participants[0]?.sid ?? null;
  }, [view, pinnedSid, speaking, participants]);

  const speakerFocusTrack = speakerFocusSid
    ? cameraTracks.find((t) => t.participant.sid === speakerFocusSid)
    : undefined;

  const focusTrack = screenShareTrack ?? speakerFocusTrack;
  const carouselTracks = focusTrack
    ? visibleTracks.filter((t) => !isEqualTrackRef(t, focusTrack))
    : [];

  const isPinned = view === "speaker" && pinnedSid !== null && !screenShareTrack;

  return (
    <div className="room-shell">
      {connectionState === ConnectionState.Reconnecting && (
        <div className="reconnect-banner" role="status" aria-live="polite">
          Reconnecting…
        </div>
      )}
      <header className="room-topbar">
        <div className="topbar-left">
          <RoomPill
            roomName={roomName}
            isHost={isHost}
            raisedIdentities={raisedIdentities}
            sharingIdentity={sharingIdentity}
            onMute={host.mute}
            onLowerHand={lowerHand}
            onStopShare={host.stopShare}
            onRemove={host.remove}
            onMuteAll={() => host.muteAll(localParticipant.identity)}
          />
          {screenShareTrack && <span className="share-badge">● Screen sharing</span>}
          {locked && <span className="lock-badge">🔒 Locked</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {isHost && (
            <WaitingHostIndicator
              waiting={waitingParticipants}
              onAdmit={host.admit}
              onDeny={host.remove}
              onAdmitAll={host.admitAll}
            />
          )}
          <RaisedHandsIndicator raised={raisedHands} />
          {isPinned && (
            <button className="link-btn" onClick={() => setPinnedSid(null)}>
              Pinned — follow speaker
            </button>
          )}
          {isHost && (
            <div className="host-bar">
              <button
                className={`ctrl-btn${waitingEnabled ? " active" : ""}`}
                title={
                  waitingEnabled
                    ? "Guests must be admitted before joining. Click to let guests in automatically."
                    : "Guests join automatically. Click to require admitting them first."
                }
                onClick={() => (waitingEnabled ? host.disableWaiting() : host.enableWaiting())}
              >
                ⧗ Waiting room: {waitingEnabled ? "On" : "Off"}
              </button>
              <button
                className={`ctrl-btn${locked ? " active" : ""}`}
                onClick={() => (locked ? host.unlock() : host.lock())}
              >
                {locked ? "🔓 Unlock" : "🔒 Lock"}
              </button>
              <button
                className="ctrl-btn danger"
                onClick={() => {
                  if (window.confirm("End the meeting for everyone?")) host.end();
                }}
              >
                End
              </button>
            </div>
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

        {/* Kept mounted (hidden via CSS) so chat history accumulates while closed. */}
        <ChatPanel hidden={!chatOpen} onClose={() => setChatOpen(false)} />
      </div>

      <div className="room-controls">
        <ControlBar
          controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true }}
        />
        <ReactionBar onReact={sendReaction} />
        <BackgroundEffectsButton />
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
