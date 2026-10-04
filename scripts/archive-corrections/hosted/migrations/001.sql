-- Dedicated corrections pilot only. No corpus/catalogue tables or PostGIS.
CREATE SCHEMA __SCHEMA__;
CREATE TABLE __SCHEMA__.migrations (version integer PRIMARY KEY, sha256 text NOT NULL);
CREATE TABLE __SCHEMA__.metadata (
  singleton integer PRIMARY KEY CHECK (singleton = 1), fixture_json text NOT NULL, api_version text NOT NULL
);
CREATE TABLE __SCHEMA__.revisions (
  text_revision text PRIMARY KEY, revision_number integer NOT NULL UNIQUE CHECK (revision_number > 0),
  based_on_revision text REFERENCES __SCHEMA__.revisions(text_revision), decision_id text UNIQUE, entity_json text NOT NULL
);
CREATE TABLE __SCHEMA__.proposals (
  proposal_id text PRIMARY KEY, base_revision text NOT NULL REFERENCES __SCHEMA__.revisions(text_revision), entity_json text NOT NULL
);
CREATE TABLE __SCHEMA__.decisions (
  decision_id text PRIMARY KEY, proposal_id text NOT NULL UNIQUE REFERENCES __SCHEMA__.proposals(proposal_id),
  base_revision text NOT NULL REFERENCES __SCHEMA__.revisions(text_revision),
  text_revision text NOT NULL REFERENCES __SCHEMA__.revisions(text_revision) DEFERRABLE INITIALLY DEFERRED, entity_json text NOT NULL
);
ALTER TABLE __SCHEMA__.revisions ADD CONSTRAINT revision_decision_fk FOREIGN KEY (decision_id)
  REFERENCES __SCHEMA__.decisions(decision_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE __SCHEMA__.requests (
  scope text NOT NULL CHECK (scope IN ('proposal', 'decision')), request_key text NOT NULL,
  payload_json text NOT NULL, result_json text NOT NULL, PRIMARY KEY (scope, request_key)
);
CREATE FUNCTION __SCHEMA__.immutable_fact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only' USING ERRCODE = '55000'; END;
$$;
-- Also deny TRUNCATE: it is not covered by DELETE triggers.
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.metadata FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.revisions FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.proposals FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.decisions FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.requests FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON __SCHEMA__.migrations FOR EACH STATEMENT EXECUTE FUNCTION __SCHEMA__.immutable_fact();
