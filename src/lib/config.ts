/**
 * Centralized, validated environment configuration.
 *
 * Secrets come from the environment only (never hardcoded/committed) — see CLAUDE.md.
 * In production, missing required values throw. In development we warn and fall back to
 * the documented .env.example dev defaults so the app still boots.
 *
 * Access is lazy + memoized via getConfig(): validation runs on first real use at
 * runtime, never at import time, so `next build` (which runs with NODE_ENV=production
 * but without a populated env) doesn't fail collecting page data.
 */

export interface Config {
  isProd: boolean;
  appUrl: string;
  database: { url: string };
  livekit: { url: string; apiKey: string; apiSecret: string };
}

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;

  const isProd = process.env.NODE_ENV === "production";

  const read = (name: string, fallback?: string): string => {
    const value = process.env[name];
    if (value && value.length > 0) return value;
    if (fallback !== undefined && !isProd) {
      console.warn(`[config] ${name} not set — using dev fallback. Set it in .env.`);
      return fallback;
    }
    throw new Error(`[config] Missing required environment variable: ${name}`);
  };

  cached = {
    isProd,
    appUrl: read("APP_URL", "http://localhost:3000"),
    database: {
      url: read("DATABASE_URL", "postgres://hearth:hearth_dev_password@localhost:5432/hearth"),
    },
    livekit: {
      // Server-side URL (token minting / server SDK). Wired up in M1.
      url: read("LIVEKIT_URL", "ws://localhost:7880"),
      apiKey: read("LIVEKIT_API_KEY", "devkey"),
      apiSecret: read("LIVEKIT_API_SECRET", "devsecret_change_me_at_least_32_characters"),
    },
  };

  return cached;
}
