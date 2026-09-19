import { and, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDb } from "../server/db/index.js";
import { questions, stages, learningAttempts } from "../server/db/schema.js";
import { getServerEnv } from "../server/env.js";

const stageParamsSchema = z.object({
  code: z.string().min(1).max(10),
});

const stageQuerySchema = z.object({ poolSize: z.coerce.number().int().min(1).max(30).optional() });

const answerBodySchema = z.object({
  questionId: z.string().min(1).max(50),
  selectedOptionIndex: z.number().int().min(0).max(3),
});

export function selectStageQuestions<T extends { difficultyLevel: string }>(stageQuestions: T[], distribution: Record<string, number>, count: number): T[] {
  if (count > Object.values(distribution).reduce((sum, value) => sum + value, 0)) return stageQuestions.slice(0, count);
  const selected: T[] = [];
  for (const [level, amount] of Object.entries(distribution)) selected.push(...stageQuestions.filter((question) => question.difficultyLevel === level).slice(0, amount));
  selected.push(...stageQuestions.filter((question) => !selected.includes(question)).slice(0, count - selected.length));
  return selected.slice(0, count);
}

export const gradeQuestion = (correctOptionIndex: number, selectedOptionIndex: number, damage: number) => ({
  isCorrect: selectedOptionIndex === correctOptionIndex,
  damage: selectedOptionIndex === correctOptionIndex ? damage : 0,
});

export const questionRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/questions/stage/:code — fetch random questions for a stage run
  app.get("/api/questions/stage/:code", async (request, reply) => {
    const params = stageParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ message: "Mã ải không hợp lệ.", issues: params.error.issues });
    }
    const query = stageQuerySchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ message: "Kích thước pool không hợp lệ.", issues: query.error.issues });

    const db = getDb();

    // Fetch stage metadata
    const [stage] = await db
      .select()
      .from(stages)
      .where(eq(stages.code, params.data.code))
      .limit(1);

    if (!stage) {
      return reply.status(404).send({ message: "Không tìm thấy ải." });
    }

    // Fetch questions — prefer approved, fallback to pending_review
    const stageQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.stageCode, params.data.code),
          sql`${questions.reviewStatus} IN ('approved', 'pending_review')`,
        ),
      )
      .orderBy(sql`RANDOM()`);

    // Distribute by difficulty according to stage config
    const distribution = (stage.difficultyDistribution ?? {}) as Record<string, number>;
    const requestedCount = query.data.poolSize ?? stage.questionsPerRun;
    const selected = selectStageQuestions(stageQuestions, distribution, requestedCount);

    // Strip correct answer for client — don't leak correct_option_index
    const clientQuestions = selected.map((q) => ({
      id: q.id,
      sortOrder: q.sortOrder,
      topic: q.topic,
      difficultyLevel: q.difficultyLevel,
      questionText: q.questionText,
      options: q.options,
      hint: q.hint,
      damage: q.damage,
    }));

    return {
      stage: {
        code: stage.code,
        displayName: stage.displayName,
        questionsPerRun: stage.questionsPerRun,
        enemyHp: stage.enemyHp,
        damagePerCorrect: stage.damagePerCorrect,
      },
      questions: clientQuestions,
    };
  });

  // POST /api/questions/answer — submit an answer and get feedback
  app.post("/api/questions/answer", async (request, reply) => {
    const parsed = answerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Dữ liệu không hợp lệ.", issues: parsed.error.issues });
    }

    const db = getDb();
    const { DEMO_PLAYER_ID } = getServerEnv();

    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, parsed.data.questionId))
      .limit(1);

    if (!question) {
      return reply.status(404).send({ message: "Không tìm thấy câu hỏi." });
    }

    const { isCorrect, damage } = gradeQuestion(question.correctOptionIndex, parsed.data.selectedOptionIndex, question.damage);
    const feedback = question.feedbacks?.[parsed.data.selectedOptionIndex] ?? "";

    // Record learning attempt
    await db.insert(learningAttempts).values({
      playerId: DEMO_PLAYER_ID,
      knowledgeId: question.id,
      isCorrect,
      score: String(damage),
      feedback,
    });

    return {
      isCorrect,
      correctOptionIndex: question.correctOptionIndex,
      damage,
      feedback,
      generalExplanation: question.generalExplanation,
    };
  });
};
