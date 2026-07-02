"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close an open popover/menu on Escape or an outside click (accessibility, M9).
 * Attach `ref` to the popover's container.
 */
export function useDismiss(
  open: boolean,
  ref: RefObject<HTMLElement>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, ref, onClose]);
}
