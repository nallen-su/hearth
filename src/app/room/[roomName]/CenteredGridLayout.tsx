"use client";

import { useRef } from "react";
import {
  ParticipantTile,
  useGridLayout,
  usePagination,
  useVisualStableUpdate,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";

/** Stable key for a track reference (real track or camera-off placeholder). */
function trackKey(t: TrackReferenceOrPlaceholder): string {
  const trackSid = t.publication?.trackSid ?? "placeholder";
  return `${t.participant.sid}_${t.source}_${trackSid}`;
}

/**
 * Grid layout that centers an incomplete last row instead of left-aligning it
 * (e.g. 8 tiles in a 3-wide grid centers the bottom 2).
 *
 * Reuses LiveKit's sizing + pagination hooks so fit-to-screen behavior and large-room
 * paging are unchanged. The trick for exact centering: lay the grid out on 2× the
 * column tracks and have each tile span 2 — then an offset for the orphan row is always
 * a whole number of sub-columns, which a normal N-column grid can't express.
 */
export default function CenteredGridLayout({
  tracks,
}: {
  tracks: TrackReferenceOrPlaceholder[];
}) {
  const gridEl = useRef<HTMLDivElement>(null);
  const { layout } = useGridLayout(gridEl, tracks.length);
  const pagination = usePagination(layout.maxTiles, tracks);
  // Keep tile positions stable across re-sorts (speaker changes, joins/leaves).
  const visibleTracks = useVisualStableUpdate(pagination.tracks, layout.maxTiles);

  const cols = Math.max(1, layout.columns);
  const n = visibleTracks.length;
  const orphans = n % cols; // tiles in a partial last row (0 when the row is full)
  const firstOrphanIndex = orphans > 0 ? n - orphans : -1;

  const containerStyle = {
    "--lk-col-count": cols,
    gridTemplateColumns: `repeat(${cols * 2}, minmax(0, 1fr))`,
  } as React.CSSProperties;

  return (
    <div
      ref={gridEl}
      data-lk-pagination={pagination.totalPageCount > 1}
      className="lk-grid-layout hearth-centered-grid"
      style={containerStyle}
    >
      {visibleTracks.map((trackRef, i) => {
        const style: React.CSSProperties =
          i === firstOrphanIndex
            ? { gridColumn: `${cols - orphans + 1} / span 2` }
            : { gridColumn: "span 2" };
        return <ParticipantTile key={trackKey(trackRef)} trackRef={trackRef} style={style} />;
      })}

      {pagination.totalPageCount > 1 && (
        <div className="hearth-pagination">
          <button onClick={pagination.prevPage} aria-label="Previous page">
            ‹
          </button>
          <span>
            {pagination.currentPage} / {pagination.totalPageCount}
          </span>
          <button onClick={pagination.nextPage} aria-label="Next page">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
