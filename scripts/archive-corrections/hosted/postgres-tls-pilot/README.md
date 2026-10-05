# D7 — private PostgreSQL TLS pilot

This exclusive addition reuses the existing portable PostgreSQL 18.6 runtime,
Python cryptography 50.0.1, Node and locked D5 dependencies. Nothing is installed
or downloaded. D4, D5, D6, H06 and their drivers remain unchanged.

1. Run `plan-run.ps1` with a new `.archive-corrections-private/d7-tls-<UUID>` path.
   It pins sources, source copies, portable runtime and existing certificate tools,
   then records preflight and an operational manifest before any certificate or
   PostgreSQL program runs. Git metadata is inherited, never refreshed with Git.
2. Run `execute.ps1` for that path. It creates a 24-hour invented CA, RSA server
   key and SAN localhost/127.0.0.1 certificate in the new private directory.
   No system certificate store is used. `NODE_EXTRA_CA_CERTS` is supplied only
   through the environment at launch of each new owned Node process.
3. The strict gate calls unchanged D5 `createNetworkDriver(url)` with its default
   Pool and attach helper. PostgreSQL `pg_stat_ssl` proves the accepted backend.
   A fresh process with an unrelated CA must fail certificate-chain validation.
   The same new cluster is stopped, then restarted with a certificate signed by
   the correct CA but SAN wrong-name.invalid; target 127.0.0.1 must fail hostname
   validation. The correct certificate is restored and positively checked again.
   No TLS verification bypass or factory override is used.
4. Only after the gate passes, the minimal Node test starts two owned processes
   using that same default driver with a restricted invented SQL role. A logs in
   and submits one invented proposal; B authorizes one decision and exports it.
   Operator restores into a new isolated empty schema in the same fresh cluster.
   IDs/canonical bytes, absence of restored access rows and TLS transaction traces
   are checked. This deliberately does not rerun D6's complete scenario suite.
5. The trace observer forwards the original installed pg Client.query unchanged,
   records only transaction event categories/PIDs/TLS booleans, and exists only
   in these new processes. It never records SQL parameters, credentials or bodies.
6. All newly owned workers and every PostgreSQL episode are stopped and their PIDs
   checked absent. `closeout.ps1` verifies old-source integrity, local hashes and
   the existing operational JSON schema. It excludes private configuration,
   passwords, private keys and pgdata from all manifested evidence. The generic
   closeout checker is not invoked because it calls Git.

The HTTP handlers remain a loopback test transport with an invented proxy HTTPS
header. D7 qualifies PostgreSQL TLS locally, not browser HTTPS, human identity,
Vercel, a remote provider, load, deployment or production readiness. Private,
machine-generated evidence only; no publishing, upload, cost or real account.
Follow-up requires a new UUID/run; executed runs and their records are immutable.
