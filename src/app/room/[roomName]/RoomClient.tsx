"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  PreJoin,
  RoomAudioRenderer,
  useTracks,
  type LocalUserChoices,
} from "@livekit/components-react";
import { Room, Track, type RoomOptions } from "livekit-client";
import "@livekit/components-styles";

// Public URL the browser dials. NEXT_PUBLIC_* is inlined at build; fall back to the
// local dev LiveKit so the app works before .env is fully populated.
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "ws://localhost:7880";

type Stage =
  | { status: "prejoin" }
  | { status: "connecting"; choices: LocalUserChoices; token: string }
  | { status: "error"; message: string };

export default function RoomClient({ roomName }: { roomName: string }) {
  const [stage, setStage] = useState<Stage>({ status: "prejoin" });

  const handlePreJoin = useCallback(
    async (choices: LocalUserChoices) => {
      try {
        const res = await fetch(
          `/api/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(
            choices.username,
          )}`,
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to get access token.");
        setStage({ status: "connecting", choices, token: body.token });
      } catch (err) {
        setStage({ status: "error", message: (err as Error).message });
      }
    },
    [roomName],
  );

  if (stage.status === "error") {
    return (
      <div className="centered">
        <p>Couldn’t join the meeting.</p>
        <p style={{ color: "var(--color-text-muted)" }}>{stage.message}</p>
        <button className="btn" onClick={() => setStage({ status: "prejoin" })}>
          Try again
        </button>
      </div>
    );
  }

  if (stage.status === "prejoin") {
    return (
      <div data-lk-theme="default" className="centered">
        <div style={{ width: "min(100%, 480px)" }}>
          <h2 style={{ textAlign: "center", marginTop: 0 }}>
            Join “<span style={{ color: "var(--color-accent)" }}>{roomName}</span>”
          </h2>
          <PreJoin
            defaults={{ username: "", videoEnabled: true, audioEnabled: true }}
            onSubmit={handlePreJoin}
            onError={(err) => setStage({ status: "error", message: err.message })}
          />
        </div>
      </div>
    );
  }

  // Remount cleanly on each new connection attempt (key) so the Room instance below is
  // never reused across sessions.
  return (
    <MeetingRoom
      key={stage.token}
      token={stage.token}
      choices={stage.choices}
      onLeave={() => setStage({ status: "prejoin" })}
      onError={(message) => setStage({ status: "error", message })}
    />
  );
}

function MeetingRoom({
  token,
  choices,
  onLeave,
  onError,
}: {
  token: string;
  choices: LocalUserChoices;
  onLeave: () => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();

  // A single, stable Room instance for the whole session. Constructing it once (rather
  // than letting LiveKitRoom recreate an internal room as props/renders change, incl.
  // React StrictMode's double-mount in dev) is what keeps published tracks from
  // flickering and stops the initial mic/camera state from being re-applied over a
  // user's manual toggle.
  const room = useMemo(() => {
    const options: RoomOptions = {
      videoCaptureDefaults: { deviceId: choices.videoDeviceId },
      audioCaptureDefaults: { deviceId: choices.audioDeviceId },
    };
    return new Room(options);
  }, [choices.videoDeviceId, choices.audioDeviceId]);

  return (
    <LiveKitRoom
      room={room}
      token={token}
      serverUrl={LIVEKIT_URL}
      connect
      video={choices.videoEnabled}
      audio={choices.audioEnabled}
      data-lk-theme="default"
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      onDisconnected={() => {
        onLeave();
        router.push("/");
      }}
      onError={(err) => onError(err.message)}
    >
      <ConferenceView />
      <RoomAudioRenderer />
      {/* M1 is intentionally scoped: mic, camera, leave only. Screen share (M3) and
          chat (M4) are added in later milestones. */}
      <ControlBar
        controls={{ microphone: true, camera: true, screenShare: false, chat: false, leave: true }}
      />
    </LiveKitRoom>
  );
}

/** Camera-tile grid. Screen-share source is deliberately excluded until M3. */
function ConferenceView() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <GridLayout tracks={tracks} style={{ height: "100%" }}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}
