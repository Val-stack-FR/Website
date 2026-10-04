# D8 — correction handler mounted in the private reader

New code only; D3 binding and D4/D5/D6/D7 remain unchanged. The existing PGlite
0.5.8 engine persists PostgreSQL SQL in a new private filesystem store, with D5
ServerlessStore/SharedSessions and the existing snapshot/payload validators.
Single owning process; no new package, service provider or account.

## Same-origin mount

Private configuration fixes reader origin `http://127.0.0.1:8810`. Run preparation
allocates a distinct backend loopback port and records it in `mount-contract.json`.
Root can either proxy these exact prefixes or import the Node handler directly:

```js
import { openIntegrated } from './scripts/archive-corrections/integrated-loopback/app.mjs';
const correctionApp = await openIntegrated(privateConfigPath, { origin: 'http://127.0.0.1:8810' });
// Route only /api/archive/preview/* and /api/archive/fixture/* to this handler.
// The reader server must itself listen on 127.0.0.1 at the configured origin.
await correctionApp.handler(request, response);
// On owned reader shutdown: await correctionApp.close();
```

Stop the standalone D8 service before opening that same store in Root's process.
The exclusive lock refuses a second owner. A proxy targets the recorded backend,
sets `Host: 127.0.0.1:8810`, preserves the browser's exact Origin, Cookie,
X-CSRF-Token, Idempotency-Key, Content-Type and request body, and forwards status,
JSON, Cache-Control and Set-Cookie unchanged. Never proxy `/__d8_control__/`, add
CORS headers, invent an Origin, or authorize with client roles/Bearer headers.
GET may omit Origin; every POST requires the exact configured reader Origin.

## Public preview contract

Only `text:atelier-494756c2009be577ad11a5eb0a662d38` is admitted. The unchanged D3
loader checks its six pinned derivative files and accepted digital-object link,
allowlist, source/transcription hash and preflight. No original or image is read;
no H07 catalogue is imported. Historical reading remains unreviewed, act/document
null, translation absent, public rights pending, publication not-published.

- `GET /api/archive/preview/health` returns the fixed passage and disabled human
  authority; `GET /api/archive/preview/passage?passage_id=<encodeURIComponent(id)>`
  returns passage/current_revision/revisions only, never the pending queue.
- `POST /api/archive/preview/corrections`, JSON exact: passage_id, base_revision,
  replacement_text, reason, evidence_refs, simulation:true. The current revision
  and evidence IDs come from GET. Use an 8–100 character ASCII Idempotency-Key.
  201 creates a private pending proposal; identical replay 200 keeps its ID;
  different payload with the same key or a stale revision returns 409.
- Preview auth session always returns authenticated:false. Historical login,
  decision, owner queue and export routes return 403 human_validation_disabled,
  even if a fixture cookie/CSRF or client flag is supplied. No historical revision
  or confirmed reading can result. An internal server operator can export the
  editorial snapshot with `app.exportEditorial('preview')`; do not expose it as
  a public Root route.

Every response keeps simulation:true, identity_verified:false,
human_validation_enabled:false, reading_confirmed:false, publication_enabled:false.
Never interpolate proposal text as HTML; Root should render it with textContent.
Secrets, filesystem paths and source locators do not enter HTTP JSON or logs.

## Disjoint invented fixture

The same paths under `/api/archive/fixture/` use only synthetic-mvp-d-001 in a
different SQL schema. Private config contains a fresh random fixture phrase and
HMAC key; they never enter HTML or a public launch contract. POST auth/login takes
only passphrase. Cookie archive_d8_fixture_owner is HttpOnly/SameSite=Strict,
Path=/api/archive/fixture; it is intentionally an HTTP loopback cookie, separate
from the frozen Secure D5/Vercel cookie. Login response supplies csrf_token;
owner decisions require SQL session, exact Origin and X-CSRF-Token. Owner queue
and export require that session. All fixture decisions remain technical tests;
no identity, historical confirmation or memory is implied. Revocation uses exact
empty JSON and CSRF. Browser owner QA was not attempted; prior auto-review refusals
are preserved, not retried through this module.

## Start, stop and restart

Run `prepare.ps1 -RunDirectory <new private d8-integrated-UUID>`, then use the
existing bundled Node runtime:

```text
node service.mjs serve <private config.private.json> <new-episode-name>
node service.mjs stop <same private config.private.json>
```

Paths above refer to this module directory. Stop uses a separate random private
control token and the backend-only endpoint; it closes the server/database and
releases the exclusive lock. It never targets a preexisting process. After the
stop record appears, restart with the same config and a new episode name. The
passage/context, original revision, IDs, requests, history and SQL sessions persist.
Do not automatically clear a stale lock after a crash: verify the exact owned
process has ended before a new recovery record and lock removal. One process only.

Gate tests cover proposal/replay, client-role and authority refusal, public reading
unchanged before fixture decision, SQL session/CSRF, decision/history/export and
real process restart preserving IDs. One real pending proposal and server-side
historical decision refusal are tested separately. Root's actual 8810 mount and
browser UI mounting remain Root's integration step; no such QA is claimed here.

All run evidence is private and generated by an agent. DB files and private
configuration/lock/secrets are excluded from the operational manifest. Closeout
checks the existing schema and local hashes without Git; the generic checker is
not invoked because it calls Git. No public release, upload or hosted qualification.
