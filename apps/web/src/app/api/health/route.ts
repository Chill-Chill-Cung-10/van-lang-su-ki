import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      services: { web: "ok", database: "ok" },
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      {
        status: "degraded",
        services: { web: "ok", database: "unavailable" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
