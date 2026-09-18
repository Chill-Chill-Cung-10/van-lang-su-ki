-- Migration: Create stages and questions tables for question bank
-- Chặng 1: 340 câu hỏi, 13 ải

CREATE TABLE IF NOT EXISTS stages (
  code TEXT PRIMARY KEY,
  chapter INTEGER NOT NULL DEFAULT 1,
  stage_type TEXT NOT NULL CHECK (stage_type IN ('main', 'side', 'boss')),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unlock_condition TEXT NOT NULL DEFAULT '',
  questions_per_run INTEGER NOT NULL,
  enemy_hp INTEGER NOT NULL,
  damage_per_correct INTEGER NOT NULL DEFAULT 10,
  difficulty_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  stage_code TEXT NOT NULL REFERENCES stages(code) ON DELETE RESTRICT,
  chapter INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL,
  topic TEXT NOT NULL,
  difficulty_level TEXT NOT NULL CHECK (difficulty_level IN ('recognize', 'understand', 'apply', 'challenge')),
  competency TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_option_index INTEGER NOT NULL CHECK (correct_option_index BETWEEN 0 AND 3),
  hint TEXT,
  feedbacks TEXT[] NOT NULL,
  general_explanation TEXT,
  source_label TEXT,
  source_code TEXT,
  damage INTEGER NOT NULL DEFAULT 10,
  ai_tag TEXT,
  draw_group TEXT NOT NULL CHECK (draw_group IN ('core', 'applied', 'challenge')),
  review_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS questions_stage_difficulty_idx ON questions(stage_code, difficulty_level);
CREATE INDEX IF NOT EXISTS questions_review_status_idx ON questions(review_status);
CREATE INDEX IF NOT EXISTS questions_chapter_idx ON questions(chapter);
