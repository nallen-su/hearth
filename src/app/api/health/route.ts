import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";
import { pingLiveKit } from "@/lib/livekit";

// Health must reflect live state, not a build-time snapshot.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health
 * 200 when the app and its required dependencies are reachable, 503 otherwise. Reports
 * per-dependency status so operators (and orchestration) can see what's degraded.
 *
 * coturn (TURN) has no HTTP surface to probe here; observe it via container health /
 * `docker compose ps` and by confirming calls connect from restrictive networks.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  const [db, livekit] = await Promise.allSettled([pingDatabase(), pingLiveKit()]);
  checks.database = db.status === "fulfilled" && db.value ? "ok" : "error";
  checks.livekit = livekit.status === "fulfilled" && livekit.value ? "ok" : "error";

  const healthy = Object.values(checks).every((status) => status === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
