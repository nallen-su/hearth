"use client";

import { useCallback } from "react";

/**
 * Client wrapper for the server-authoritative host endpoints. The host key is sent with
 * every call and verified server-side; nothing here is trusted on its own.
 */
export function useHostActions(inviteToken: string, hostKey: string | null) {
  const call = useCallback(
    async (action: string, targetIdentity?: string) => {
      if (!hostKey) return;
      try {
        await fetch("/api/host", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite: inviteToken, hostKey, action, targetIdentity }),
        });
      } catch {
        /* network error — action simply doesn't take effect */
      }
    },
    [inviteToken, hostKey],
  );

  return {
    enabled: Boolean(hostKey),
    mute: (identity: string) => call("mute", identity),
    remove: (identity: string) => call("remove", identity),
    stopShare: (identity: string) => call("stop_share", identity),
    muteAll: (exceptIdentity: string) => call("mute_all", exceptIdentity),
    lock: () => call("lock"),
    unlock: () => call("unlock"),
    end: () => call("end"),
    admit: (identity: string) => call("admit", identity),
    admitAll: () => call("admit_all"),
    enableWaiting: () => call("enable_waiting"),
    disableWaiting: () => call("disable_waiting"),
  };
}
