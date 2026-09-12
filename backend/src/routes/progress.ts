import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDb } from "../server/db/index.js";
import { playerProfiles, questProgress } from "../server/db/schema.js";
import { getServerEnv } from "../server/env.js";

const updateSchema = z.object({
  questId: z.string().min(1).max(100),
  status: z.enum(["locked", "available", "in_progress", "completed"]),
  progress: z.record(z.string(), z.unknown()).default({}),
});

export const progressRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/progress", async (_request, reply) => {
    const { DEMO_PLAYER_ID } = getServerEnv();
    const db = getDb();
    const [profile] = await db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.id, DEMO_PLAYER_ID))
      .limit(1);
    const quests = await db
      .select()
      .from(questProgress)
      .where(eq(questProgress.playerId, DEMO_PLAYER_ID));

    if (!profile) {
      return reply.status(404).send({ message: "Không tìm thấy hồ sơ demo." });
    }

    return { profile, quests };
  });

  app.patch("/api/progress", async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Dữ liệu không hợp lệ.",
        issues: parsed.error.issues,
      });
    }

    const { DEMO_PLAYER_ID } = getServerEnv();
    const db = getDb();
    const [saved] = await db
      .insert(questProgress)
      .values({
        playerId: DEMO_PLAYER_ID,
        ...parsed.data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [questProgress.playerId, questProgress.questId],
        set: {
          status: parsed.data.status,
          progress: parsed.data.progress,
          updatedAt: new Date(),
        },
      })
      .returning();

    return { quest: saved };
  });
};
