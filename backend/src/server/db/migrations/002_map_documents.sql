CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maps (
  map_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_src TEXT,
  active_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id TEXT NOT NULL REFERENCES maps(map_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  schema_version INTEGER NOT NULL,
  document JSONB NOT NULL,
  checksum TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (map_id, revision),
  UNIQUE (map_id, id)
);

DO $$ BEGIN
  ALTER TABLE maps ADD CONSTRAINT maps_active_revision_fk
    FOREIGN KEY (map_id, active_revision_id)
    REFERENCES map_revisions(map_id, id)
    DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS map_revisions_map_id_created_at_idx ON map_revisions(map_id, created_at DESC);
