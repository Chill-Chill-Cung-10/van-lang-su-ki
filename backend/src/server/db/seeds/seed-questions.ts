import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getPool, closeDb } from "../index.js";

interface SeedStage {
  code: string;
  chapter: number;
  stageType: string;
  displayName: string;
  description: string;
  unlockCondition: string;
  questionsPerRun: number;
  enemyHp: number;
  damagePerCorrect: number;
  difficultyDistribution: Record<string, number>;
  sortOrder: number;
}

interface SeedQuestion {
  id: string;
  stageCode: string;
  chapter: number;
  sortOrder: number;
  topic: string;
  difficultyLevel: string;
  competency: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  hint: string | null;
  feedbacks: string[];
  generalExplanation: string | null;
  sourceLabel: string | null;
  sourceCode: string | null;
  damage: number;
  aiTag: string | null;
  drawGroup: string;
  reviewStatus: string;
}

async function seedQuestions() {
  const seedDir = fileURLToPath(new URL(".", import.meta.url));

  const stagesRaw = await readFile(new URL("c1-stages.json", `file://${seedDir}`), "utf8");
  const stagesData: SeedStage[] = JSON.parse(stagesRaw);

  const questionsRaw = await readFile(new URL("c1-questions.json", `file://${seedDir}`), "utf8");
  const questionsData: SeedQuestion[] = JSON.parse(questionsRaw);

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Insert stages
    for (const s of stagesData) {
      await client.query(
        `INSERT INTO stages(code, chapter, stage_type, display_name, description, unlock_condition,
          questions_per_run, enemy_hp, damage_per_correct, difficulty_distribution, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (code) DO NOTHING`,
        [
          s.code, s.chapter, s.stageType, s.displayName, s.description,
          s.unlockCondition, s.questionsPerRun, s.enemyHp, s.damagePerCorrect,
          JSON.stringify(s.difficultyDistribution), s.sortOrder,
        ],
      );
    }
    console.log(`Inserted ${stagesData.length} stages`);

    // Insert questions
    for (const q of questionsData) {
      await client.query(
        `INSERT INTO questions(id, stage_code, chapter, sort_order, topic, difficulty_level,
          competency, question_text, options, correct_option_index, hint, feedbacks,
          general_explanation, source_label, source_code, damage, ai_tag, draw_group, review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (id) DO NOTHING`,
        [
          q.id, q.stageCode, q.chapter, q.sortOrder, q.topic, q.difficultyLevel,
          q.competency, q.questionText, q.options, q.correctOptionIndex,
          q.hint, q.feedbacks, q.generalExplanation, q.sourceLabel, q.sourceCode,
          q.damage, q.aiTag, q.drawGroup, q.reviewStatus,
        ],
      );
    }
    console.log(`Inserted ${questionsData.length} questions`);

    await client.query("COMMIT");
    console.log("Seed completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closeDb();
  }
}

await seedQuestions();
