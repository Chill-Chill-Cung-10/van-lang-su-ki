CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  current_level INTEGER NOT NULL DEFAULT 1 CHECK (current_level > 0),
  experience_points INTEGER NOT NULL DEFAULT 0 CHECK (experience_points >= 0),
  historical_mastery INTEGER NOT NULL DEFAULT 0 CHECK (historical_mastery BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  knowledge_id TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  score NUMERIC(5, 2),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, quest_id)
);

INSERT INTO player_profiles (id, display_name, current_level, experience_points, historical_mastery)
VALUES ('00000000-0000-4000-8000-000000000001', 'Người chơi Demo', 3, 720, 42)
ON CONFLICT (id) DO NOTHING;

INSERT INTO quest_progress (player_id, quest_id, status, progress)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'van-lang-khoi-nguyen', 'completed', '{"score": 90}'),
  ('00000000-0000-4000-8000-000000000001', 'bach-dang-938', 'available', '{}')
ON CONFLICT (player_id, quest_id) DO NOTHING;
