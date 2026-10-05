-- MVP-D v1: only immutable facts, no editable current-text pointer.
CREATE TABLE IF NOT EXISTS metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  fixture_json TEXT NOT NULL,
  api_version TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS revisions (
  text_revision TEXT PRIMARY KEY,
  revision_number INTEGER NOT NULL UNIQUE CHECK (revision_number > 0),
  based_on_revision TEXT REFERENCES revisions(text_revision),
  decision_id TEXT UNIQUE REFERENCES decisions(decision_id) DEFERRABLE INITIALLY DEFERRED,
  entity_json TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS proposals (
  proposal_id TEXT PRIMARY KEY,
  base_revision TEXT NOT NULL REFERENCES revisions(text_revision),
  entity_json TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS decisions (
  decision_id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE REFERENCES proposals(proposal_id),
  base_revision TEXT NOT NULL REFERENCES revisions(text_revision),
  text_revision TEXT NOT NULL REFERENCES revisions(text_revision) DEFERRABLE INITIALLY DEFERRED,
  entity_json TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS requests (
  scope TEXT NOT NULL CHECK (scope IN ('proposal', 'decision')),
  request_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  PRIMARY KEY (scope, request_key)
) STRICT;
