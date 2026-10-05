# Immediate Root contract — D8 direct mount, explicit origin 8810

Import `openIntegrated` from `scripts/archive-corrections/integrated-loopback/app.mjs`.
Call `await openIntegrated(absolutePrivateConfigPath, { origin: 'http://127.0.0.1:8810' })`.
The supplied origin must equal the private config's public_origin; it is never
derived from a request header. Returned object exposes `handler(req,res)`,
`close()` and server-only `exportEditorial('preview'|'fixture')`.

Root's Node server must listen on 127.0.0.1. Dispatch only paths beginning
`/api/archive/preview/` or `/api/archive/fixture/` to the handler with the original
Node IncomingMessage/ServerResponse. Forward no invented headers. Every request
must have Host 127.0.0.1:8810; every POST needs Origin http://127.0.0.1:8810.
GET may omit Origin. No CORS. Keep the site upstream 8801 outside this module.

Exact routes per profile: GET health, GET passage?passage_id=<encoded ID>, POST
corrections; GET auth/session. Fixture additionally admits POST auth/login,
auth/logout, auth/revoke-all, owner/decisions; GET owner/corrections, owner/export.
POST corrections exact fields: passage_id, base_revision, replacement_text,
reason, evidence_refs, simulation:true; Idempotency-Key required.

Preview ID is text:atelier-494756c2009be577ad11a5eb0a662d38. Read its current
revision/evidence IDs from GET. Pending proposals do not alter that reading.
All historical owner/login/decision/export paths are hard-disabled (403), even
with fixture session/CSRF. Fixture cookie is HttpOnly/SameSite=Strict with
Path=/api/archive/fixture; decisions and revocations require exact Origin and CSRF.
No client roles/Bearer headers. Secrets exist only in private config/SQL.

Every response preserves simulation:true, identity_verified:false,
human_validation_enabled:false, reading_confirmed:false, publication_enabled:false.
Treat all returned text as plain text, never HTML or human-confirmed memory.

After the executor gate stops its owned children and releases the store lock,
`mount-ready.json` identifies the private config path for Root. Do not open the
same PGlite filesystem concurrently. Root closes this app on its own shutdown.
The executor neither mounts nor changes Root's server or shared plans.
