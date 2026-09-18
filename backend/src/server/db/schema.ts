import { boolean, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const stages = pgTable("stages", {
  code: text("code").primaryKey(),
  chapter: integer("chapter").notNull().default(1),
  stageType: text("stage_type").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull().default(""),
  unlockCondition: text("unlock_condition").notNull().default(""),
  questionsPerRun: integer("questions_per_run").notNull(),
  enemyHp: integer("enemy_hp").notNull(),
  damagePerCorrect: integer("damage_per_correct").notNull().default(10),
  difficultyDistribution: jsonb("difficulty_distribution").notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  stageCode: text("stage_code").notNull().references(() => stages.code, { onDelete: "restrict" }),
  chapter: integer("chapter").notNull().default(1),
  sortOrder: integer("sort_order").notNull(),
  topic: text("topic").notNull(),
  difficultyLevel: text("difficulty_level").notNull(),
  competency: text("competency").notNull(),
  questionText: text("question_text").notNull(),
  options: text("options").array().notNull(),
  correctOptionIndex: integer("correct_option_index").notNull(),
  hint: text("hint"),
  feedbacks: text("feedbacks").array().notNull(),
  generalExplanation: text("general_explanation"),
  sourceLabel: text("source_label"),
  sourceCode: text("source_code"),
  damage: integer("damage").notNull().default(10),
  aiTag: text("ai_tag"),
  drawGroup: text("draw_group").notNull(),
  reviewStatus: text("review_status").notNull().default("pending_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerProfiles = pgTable("player_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  currentLevel: integer("current_level").notNull().default(1),
  experiencePoints: integer("experience_points").notNull().default(0),
  historicalMastery: integer("historical_mastery").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const learningAttempts = pgTable("learning_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
  knowledgeId: text("knowledge_id").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  score: numeric("score", { precision: 5, scale: 2 }),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questProgress = pgTable(
  "quest_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    status: text("status").notNull().default("locked"),
    progress: jsonb("progress").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("quest_progress_player_quest_key").on(table.playerId, table.questId)],
);

export const maps = pgTable("maps", {
  mapId: text("map_id").primaryKey(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull().default(""),
  thumbnailSrc: text("thumbnail_src"),
  activeRevisionId: uuid("active_revision_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mapRevisions = pgTable(
  "map_revisions",
  {
    id: uuid("id").notNull().defaultRandom(),
    mapId: text("map_id").notNull().references(() => maps.mapId, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    document: jsonb("document").notNull(),
    checksum: text("checksum").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique("map_revisions_map_revision_key").on(table.mapId, table.revision),
    unique("map_revisions_map_id_id_key").on(table.mapId, table.id),
  ],
);

export const mapFlows = pgTable("map_flows", {
  flowId: text("flow_id").primaryKey(),
  displayName: text("display_name").notNull(),
  activeRevisionId: uuid("active_revision_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mapFlowRevisions = pgTable(
  "map_flow_revisions",
  {
    id: uuid("id").notNull().defaultRandom(),
    flowId: text("flow_id").notNull().references(() => mapFlows.flowId, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    document: jsonb("document").notNull(),
    checksum: text("checksum").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique("map_flow_revisions_flow_revision_key").on(table.flowId, table.revision),
    unique("map_flow_revisions_flow_id_id_key").on(table.flowId, table.id),
  ],
);
