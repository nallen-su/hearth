/**
 * Minimal structured logger (FR-25). Emits one JSON object per line so operators can
 * ship logs to whatever they run (Loki, CloudWatch, etc.) without a parsing step. No
 * external dependency, no telemetry — it only writes to stdout/stderr.
 *
 * Never log secrets or message content (privacy guardrail); log identifiers and outcomes.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
