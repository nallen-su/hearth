"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import type { LocalVideoTrack } from "livekit-client";
import type { BackgroundProcessorWrapper } from "@livekit/track-processors";
import { useDismiss } from "./useDismiss";

// Served from our own origin (populated by `npm run setup:effects`) — never a CDN, so
// nothing loads from a third party at runtime (Hearth privacy guardrail).
const ASSET_PATHS = {
  tasksVisionFileSet: "/mediapipe/tasks-vision",
  modelAssetPath: "/mediapipe/selfie_segmenter.tflite",
};
const BLUR_RADIUS = 12;

type Background = { id: string; label: string; url: string };
type Selection = "none" | "blur" | string; // otherwise a background id

/** Build a gradient background as a data URL — no bundled photos, no external assets. */
function makeGradient(from: string, to: string): string {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 720;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

function optionsFor(selection: Selection, backgrounds: Background[]) {
  if (selection === "blur") return { mode: "background-blur" as const, blurRadius: BLUR_RADIUS };
  const bg = backgrounds.find((b) => b.id === selection);
  return { mode: "virtual-background" as const, imagePath: bg?.url ?? "" };
}

/**
 * In-meeting background effects (M7): none / blur / a couple of generated virtual
 * backgrounds. Applies a processor to the local camera track and re-applies when the
 * track changes (camera toggled off/on). Hidden entirely when the browser can't support
 * the processors (graceful fallback, FR-19). MediaPipe is dynamically imported so it
 * stays out of SSR and the initial bundle.
 */
export function BackgroundEffectsButton() {
  const { cameraTrack } = useLocalParticipant();
  const [supported, setSupported] = useState(false);
  const [selection, setSelection] = useState<Selection>("none");
  const [open, setOpen] = useState(false);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const procRef = useRef<BackgroundProcessorWrapper | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(open, menuRef, () => setOpen(false));

  useEffect(() => {
    setBackgrounds([
      { id: "sunset", label: "Sunset", url: makeGradient("#f6d365", "#fda085") },
      { id: "ocean", label: "Ocean", url: makeGradient("#2b5876", "#4e4376") },
    ]);
    import("@livekit/track-processors")
      .then((m) => setSupported(m.supportsBackgroundProcessors()))
      .catch(() => setSupported(false));
  }, []);

  useEffect(() => {
    const track = cameraTrack?.track as LocalVideoTrack | undefined;
    if (!track) return;
    let cancelled = false;

    (async () => {
      try {
        if (selection === "none") {
          if (procRef.current) {
            await track.stopProcessor();
            procRef.current = null;
          }
          return;
        }
        const options = optionsFor(selection, backgrounds);
        const { BackgroundProcessor } = await import("@livekit/track-processors");
        if (cancelled) return;
        if (!procRef.current) {
          procRef.current = BackgroundProcessor({ ...options, assetPaths: ASSET_PATHS });
        }
        if (track.getProcessor() !== procRef.current) {
          await track.setProcessor(procRef.current);
        }
        if (cancelled) return;
        await procRef.current.switchTo(options);
      } catch (err) {
        console.warn("[effects] failed to apply background effect:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cameraTrack, selection, backgrounds]);

  if (!supported) return null;

  const items: { id: Selection; label: string }[] = [
    { id: "none", label: "None" },
    { id: "blur", label: "Blur" },
    ...backgrounds.map((b) => ({ id: b.id, label: b.label })),
  ];

  return (
    <div className="reaction-bar" ref={menuRef}>
      <button
        className={`ctrl-btn${selection !== "none" ? " active" : ""}`}
        aria-label="Background effects"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ✨ Effects
      </button>
      {open && (
        <div className="reaction-popover effects-popover" role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              className={selection === item.id ? "active" : ""}
              onClick={() => {
                setSelection(item.id);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
