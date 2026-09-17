CREATE TABLE IF NOT EXISTS map_flows (
  flow_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  active_revision_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_flow_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id TEXT NOT NULL REFERENCES map_flows(flow_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  schema_version INTEGER NOT NULL,
  document JSONB NOT NULL,
  checksum TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flow_id, revision),
  UNIQUE (flow_id, id)
);

DO $$ BEGIN
  ALTER TABLE map_flows ADD CONSTRAINT map_flows_active_revision_fk
    FOREIGN KEY (flow_id, active_revision_id)
    REFERENCES map_flow_revisions(flow_id, id)
    DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS map_flow_revisions_flow_id_created_at_idx ON map_flow_revisions(flow_id, created_at DESC);

INSERT INTO map_flows(flow_id, display_name)
SELECT 'vanlang', 'Văn Lang' WHERE EXISTS (SELECT 1 FROM maps WHERE map_id = 'vanlang')
ON CONFLICT (flow_id) DO NOTHING;

WITH active_map AS (
  SELECT r.revision
  FROM maps m JOIN map_revisions r ON r.id = m.active_revision_id AND r.map_id = m.map_id
  WHERE m.map_id = 'vanlang'
), flow_document AS (
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'flowId', 'vanlang',
    'nodes', jsonb_build_array(jsonb_build_object('mapId', 'vanlang', 'mapRevision', revision, 'position', jsonb_build_object('x', 0.5, 'y', 0.5)))
  ) AS document
  FROM active_map
), inserted AS (
  INSERT INTO map_flow_revisions(flow_id, revision, schema_version, document, checksum, created_by)
  SELECT 'vanlang', 1, 1, document, encode(digest(document::text, 'sha256'), 'hex'), 'migration-seed'
  FROM flow_document
  WHERE NOT EXISTS (SELECT 1 FROM map_flow_revisions WHERE flow_id = 'vanlang')
  RETURNING id
)
UPDATE map_flows SET active_revision_id = inserted.id, updated_at = NOW()
FROM inserted WHERE flow_id = 'vanlang';
