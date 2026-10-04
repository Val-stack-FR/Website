-- ADDITIONAL migration. 001 and the editorial snapshot contract are unchanged.
CREATE TABLE __SCHEMA__.owner_credentials (
  singleton integer PRIMARY KEY CHECK (singleton=1), generation uuid NOT NULL,
  salt text NOT NULL CHECK (salt ~ '^[0-9a-f]{32}$'),
  verifier text NOT NULL CHECK (verifier ~ '^[0-9a-f]{64}$'), created_ms bigint NOT NULL
);
CREATE TABLE __SCHEMA__.owner_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'), generation uuid NOT NULL,
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  created_ms bigint NOT NULL, touched_ms bigint NOT NULL CHECK (touched_ms >= created_ms)
);
CREATE INDEX sessions_generation ON __SCHEMA__.owner_sessions (generation, created_ms);
CREATE TABLE __SCHEMA__.session_revocations (
  token_hash text PRIMARY KEY REFERENCES __SCHEMA__.owner_sessions(token_hash),
  revoked_ms bigint NOT NULL, reason text NOT NULL CHECK (reason IN ('logout', 'revoke_all', 'session_limit'))
);
CREATE TABLE __SCHEMA__.owner_events (
  event_id uuid PRIMARY KEY, action text NOT NULL CHECK (action IN ('enroll', 'rotate')),
  previous_generation uuid, generation uuid NOT NULL, created_ms bigint NOT NULL
);
CREATE TABLE __SCHEMA__.rate_events (
  event_id uuid PRIMARY KEY, bucket text NOT NULL CHECK (bucket IN ('login', 'proposal')),
  created_ms bigint NOT NULL
);
CREATE INDEX rate_window ON __SCHEMA__.rate_events (bucket, created_ms);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.session_revocations FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.owner_events FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.rate_events FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
