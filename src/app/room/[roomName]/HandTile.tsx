"use client";

import { ParticipantTile, useEnsureTrackRef } from "@livekit/components-react";
import type { ParticipantClickEvent } from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";

/**
 * A ParticipantTile with a raised-hand badge overlaid on it (M4 polish). Works in the
 * grid (trackRef passed explicitly) and the carousel (trackRef comes from context) via
 * useEnsureTrackRef. The layout style (e.g. grid-column) goes on the wrapper so the
 * wrapper is the grid/carousel item.
 */
export default function HandTile({
  trackRef,
  raisedIdentities,
  style,
  onParticipantClick,
}: {
  trackRef?: TrackReferenceOrPlaceholder;
  raisedIdentities: Set<string>;
  style?: React.CSSProperties;
  onParticipantClick?: (event: ParticipantClickEvent) => void;
}) {
  const ref = useEnsureTrackRef(trackRef);
  const isRaised = raisedIdentities.has(ref.participant.identity);

  return (
    <div className="hearth-tile" style={style}>
      <ParticipantTile trackRef={ref} onParticipantClick={onParticipantClick} />
      {isRaised && (
        <span className="hand-badge" aria-label="Hand raised" title="Hand raised">
          ✋
        </span>
      )}
    </div>
  );
}
