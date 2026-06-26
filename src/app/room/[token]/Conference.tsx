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
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomInfo,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import { isEqualTrackRef } from "@livekit/components-core";
import { Track } from "livekit-client";
import CenteredGridLayout from "./CenteredGridLayout";
import HandTile from "./HandTile";
import RoomPill from "./RoomPill";
import ChatPanel from "./ChatPanel";
import { ReactionBar, ReactionsOverlay, useReactions } from "./Reactions";
import { RaiseHandButton, RaisedHandsIndicator, useRaisedHands } from "./RaiseHand";
import { useHostActions } from "./useHostActions";

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
}: {
  roomName: string;
  inviteToken: string;
  hostKey: string | null;
  isHost: boolean;
}) {
  const [view, setView] = useState<View>("grid");
  const [pinnedSid, setPinnedSid] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const { localParticipant } = useLocalParticipant();
  const host = useHostActions(inviteToken, hostKey);

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

  // Lock state lives in LiveKit room metadata so every client sees it live.
  const roomInfo = useRoomInfo();
  const locked = useMemo(() => {
    try {
      return Boolean(JSON.parse(roomInfo.metadata || "{}").locked);
    } catch {
      return false;
    }
  }, [roomInfo.metadata]);

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
  const sharingIdentity = screenShareTrack?.participant.identity ?? null;

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

  const focusTrack = screenShareTrack ?? speakerFocusTrack;
  const carouselTracks = focusTrack
    ? tracks.filter((t) => !isEqualTrackRef(t, focusTrack))
    : [];

  const isPinned = view === "speaker" && pinnedSid !== null && !screenShareTrack;

  return (
    <div className="room-shell">
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
          <RaisedHandsIndicator raised={raisedHands} />
          {isPinned && (
            <button className="link-btn" onClick={() => setPinnedSid(null)}>
              Pinned — follow speaker
            </button>
          )}
          {isHost && (
            <div className="host-bar">
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
