import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db";
import { playerProfiles, questProgress } from "@/server/db/schema";
import { getServerEnv } from "@/server/env";

const updateSchema = z.object({
  questId: z.string().min(1).max(100),
  status: z.enum(["locked", "available", "in_progress", "completed"]),
  progress: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const { DEMO_PLAYER_ID } = getServerEnv();
  const db = getDb();
  const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, DEMO_PLAYER_ID)).limit(1);
  const quests = await db.select().from(questProgress).where(eq(questProgress.playerId, DEMO_PLAYER_ID));

  if (!profile) return NextResponse.json({ message: "Không tìm thấy hồ sơ demo." }, { status: 404 });
  return NextResponse.json({ profile, quests });
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Dữ liệu không hợp lệ.", issues: parsed.error.issues }, { status: 400 });
  }

  const { DEMO_PLAYER_ID } = getServerEnv();
  const db = getDb();
  const [saved] = await db
    .insert(questProgress)
    .values({ playerId: DEMO_PLAYER_ID, ...parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [questProgress.playerId, questProgress.questId],
      set: { status: parsed.data.status, progress: parsed.data.progress, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ quest: saved });
}
