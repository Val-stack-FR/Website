-- PREPARATION ONLY; validated __SCHEMA__ and an existing operator-created app role.
-- Use a separate runtime role from the migration/seed operator. No role is created here.
REVOKE ALL ON SCHEMA __SCHEMA__ FROM PUBLIC;
GRANT USAGE ON SCHEMA __SCHEMA__ TO archive_corrections_app;
GRANT SELECT ON __SCHEMA__.migrations, __SCHEMA__.metadata, __SCHEMA__.revisions,
  __SCHEMA__.proposals, __SCHEMA__.decisions, __SCHEMA__.requests, __SCHEMA__.rate_events TO archive_corrections_app;
GRANT INSERT ON __SCHEMA__.proposals, __SCHEMA__.requests, __SCHEMA__.rate_events TO archive_corrections_app;
-- No revision/decision inserts, owner tables, DDL, update/delete or source edits.
