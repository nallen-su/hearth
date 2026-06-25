import RoomClient from "./RoomClient";

/**
 * Meeting route. The heavy lifting (media, LiveKit connection) is client-side; this
 * server component just resolves the room name from the URL.
 */
export default function RoomPage({ params }: { params: { roomName: string } }) {
  return <RoomClient roomName={decodeURIComponent(params.roomName)} />;
}
