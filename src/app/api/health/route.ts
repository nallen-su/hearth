import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db";

// Health must reflect live state, not a build-time snapshot.
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Returns 200 when the app and its required dependencies are reachable, 503 otherwise.
 * Used by operators and container orchestration for liveness/readiness.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    checks.database = (await pingDatabase()) ? "ok" : "error";
  } catch {
    checks.database = "error";
  }

  const healthy = Object.values(checks).every((status) => status === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
