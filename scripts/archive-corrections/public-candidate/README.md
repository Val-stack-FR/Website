# HTTPS archives candidate — canonical fixture, private Monbezon mapping

This new module leaves D3–D8 and Root's mounted D8 store unchanged. Canonical
origin is exactly https://valerianteissier.com, including Host and HTTPS proxy
metadata. No local HTTP fallback, alternate domain, CORS or client owner authority.

## Executable runtime contract

`function.mjs` exports a default Node/Vercel handler `(request, response)`.
Importing it reads no environment and opens no pool. A future hosting request
loads required private runtime variables; missing/unsafe configuration returns
503 before creating any driver. The factory `createConfiguredCandidate(env)`
returns `{ handler, close }` for explicit Node mounting. Production defaults to
the unchanged D5 `createNetworkDriver` with strict TLS and its default lifecycle
helper; no TLS options, URL query or PGlite fallback can be selected by runtime env.

Required variable names are listed with empty values in `env.example`:

- ARCHIVE_PUBLIC_CANDIDATE_PROFILE: fixture is the only active runtime profile.
- ARCHIVE_PUBLIC_CANDIDATE_ORIGIN: the exact canonical HTTPS origin above.
- ARCHIVE_PUBLIC_CANDIDATE_DATABASE_URL: private PostgreSQL runtime-role URL.
- ARCHIVE_PUBLIC_CANDIDATE_SCHEMA: a fresh `archive_corrections_d5_public_fixture`
  schema, optionally suffixed with 1–12 lowercase letters/digits/underscores.
- ARCHIVE_PUBLIC_CANDIDATE_SESSION_HMAC_KEY: private 256-bit lowercase hex key;
  required by the existing SQL rate/session primitive, no owner login enabled.
- ARCHIVE_PUBLIC_CANDIDATE_OWNER_MODE: disabled; any other value is refused.

No values or live credential are supplied by this candidate. Do not serialize
runtime config into HTML, client code, diagnostics or logs. The qualified host
must supply/replace HTTPS transport metadata; do not trust client X-Forwarded-Proto
through an arbitrary proxy. Every POST requires the exact Origin, and raw duplicate
authority/mutation headers are refused.

Active prefix: `/api/archive/public/fixture/` with GET health, GET
passage?passage_id=synthetic-mvp-d-001, POST corrections. The adapter only changes
this prefix to D5's internal route; it preserves raw headers/body stream and the
original request URL. Proposal fields are the existing exact six-field contract
with simulation:true and Idempotency-Key. Public responses retain D5 IDs/version
and always force identity, human validation, confirmed reading, owner authority
and publication false. No cookie is issued. All auth/owner login, decision, queue,
export and revoke routes return 403 before SQL. No environment flag can enable them.

The API does not auto-migrate, seed or enroll. Before serving, an approved operator
must prepare a new schema with frozen D5 migration/seed and runtime grants, using
a separate private operator connection. Existing D5 operator.mjs supports migrate
and seed on the fixture; adapt the operator's environment names explicitly to its
documented contract. Do not enroll an owner as part of this candidate. No database,
role, secret or provider was created/connected in this task.

## Website deployment delta

`deployment.mjs <new private D9 run>` creates `deployment-overlay/`: 20 explicit
API entrypoint wrappers (fixture/monbezon routes), a merge proposal retaining the
captured Website build/output/security headers, and a deployment manifest. Applying
the API delta inside the existing Website project makes all relative imports point
to this module's executable function. The merge proposal is reviewable; original
vercel.json is not modified. Private context, derivatives, evidence and database
directories are excluded from the deployment delta and public static artifacts.

The existing nested D5 package/lock pins pg 8.23.1 and @vercel/functions 3.9.11.
An approved hosting build must make those dependencies available; no installCommand
is automatically added and no installation is run here. Node 24, hosting/runtime,
database/operator roles, migration/seed/grants, TLS trust, canonical HTTPS ingress
and dependency provisioning are external deployment gates, not an executed release.
Root's static archives package and final deployment merge remain Root's scope.

## One Monbezon context, private and exact

`context-mapping.mjs <new private D9 run>` consumes only the six closed D3 derivative
copies after pinned preflight. It writes the unchanged D3 context/r1 to
monbezon-context.private.json and a text-free mapping proof with hashes and statuses.
No original, image, H07 catalogue or D8 store is read. Text, source revision,
unreviewed status, null act/document, absent translation, digital-object-link-only
review and pending public rights are preserved. The context file is not deployed.

ARCHIVE_PUBLIC_CANDIDATE_PROFILE=monbezon fails with 503 publication_rights_pending
before a driver is created; requesting a Monbezon path from the fixture runtime is
404. A public historical profile requires a separately approved rights gate and
explicit implementation. Human owner access needs its own qualification even after
content rights approval. No test acceptance is a historical confirmation or memory.

## Evidence and limits

Prepare with prepare.ps1 in a new d9-public-candidate-UUID private folder. Gate tests
use direct in-memory Node request/response objects and the existing PGlite engine in
a fresh isolated fixture directory; they open no TCP/HTTP/PostgreSQL socket and read
no actual runtime credential. Default TLS wiring is inherited from D5/D7, not replayed.
Tests cover missing config, canonical routing, owner denial before SQL, fixture
proposal/replay, private Monbezon mapping/public refusal and executable delta imports.
closeout.ps1 checks old-source integrity, output hashes and the existing operational
schema without Git. All records remain private; no publication/deployment is claimed.
