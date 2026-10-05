-- PREPARATION ONLY. Existing application role, replace validated dedicated D5 schema.
REVOKE ALL ON SCHEMA __SCHEMA__ FROM PUBLIC;
GRANT USAGE ON SCHEMA __SCHEMA__ TO archive_corrections_app;
GRANT SELECT ON __SCHEMA__.migrations, __SCHEMA__.metadata,
  __SCHEMA__.revisions, __SCHEMA__.proposals, __SCHEMA__.decisions, __SCHEMA__.requests,
  __SCHEMA__.owner_credentials, __SCHEMA__.owner_sessions, __SCHEMA__.session_revocations,
  __SCHEMA__.owner_events, __SCHEMA__.rate_events TO archive_corrections_app;
GRANT INSERT ON __SCHEMA__.revisions, __SCHEMA__.proposals, __SCHEMA__.decisions, __SCHEMA__.requests,
  __SCHEMA__.owner_sessions, __SCHEMA__.session_revocations, __SCHEMA__.rate_events TO archive_corrections_app;
GRANT UPDATE (touched_ms) ON __SCHEMA__.owner_sessions TO archive_corrections_app;
-- No owner_credentials write, owner_events write, migration/metadata write, DDL or destructive facts.
-- Offline operator has separate reviewed privileges. No role/account/password is created here.
