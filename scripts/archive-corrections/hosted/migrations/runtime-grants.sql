-- PREPARATION ONLY. An operator substitutes the validated dedicated schema.
-- Existing runtime role; never use the migration owner as the application credential.
-- No CREATE ROLE, password, provider or billing operation here.
REVOKE ALL ON SCHEMA __SCHEMA__ FROM PUBLIC;
GRANT USAGE ON SCHEMA __SCHEMA__ TO archive_corrections_app;
GRANT SELECT ON __SCHEMA__.migrations TO archive_corrections_app;
GRANT SELECT, INSERT ON __SCHEMA__.metadata, __SCHEMA__.revisions,
  __SCHEMA__.proposals, __SCHEMA__.decisions, __SCHEMA__.requests TO archive_corrections_app;
-- The role has no UPDATE, DELETE, TRUNCATE, DDL or function ownership rights.
