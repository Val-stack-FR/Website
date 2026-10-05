# Private integrated media preview

This separate loopback preview consumes only the reviewed seven-file Monbezon candidate and the existing reader at a literal loopback origin. It does not access corpus originals, modify the source reader, change rights or activate publication.

It pins the candidate checksums, retains the two accepted source view IDs, and substitutes the two image bindings everywhere in reader and H05 markup. The derivative keeps the native 3968 × 2976 raster with no rotation. Other dossiers, text, controls, review states and provenance stay in the source reader. Closed GET/HEAD routes delegate existing consultation endpoints; mutations, private files, cross-origin requests, path escapes, redirects and oversized bodies are refused. The integrated service depends on the existing reader: it is a private integration test, not durable hosting or a production release.

Inbound GET/HEAD requests must have exactly one Host header and no body framing (Content-Length, Transfer-Encoding or Expect). Duplicate Origin/Sec-Fetch-Site headers are rejected before parsing routes or fetching the reader. Refused requests close their connection; the server caps header size at 8 KiB. Upstream response bytes have their own separate 32 MiB streamed bound.

Run from this checkout with the bundled Node runtime:

```text
node --test tests/archives-integration/media-preview.test.mjs
node scripts/archives-integration/media-preview.mjs --base http://127.0.0.1:8769 --media <reviewed-candidate-directory> --port 8795
```

The approved candidate is recorded in PERSO `atelier-tuce/planning/media-release/handoff-lecteur.md`. Serve only its `candidate/` directory, never the containing private run. The two sanitized JPEG bytes are checked and cached at startup. `/__integrated_media_provenance` preserves the prepared overlay and its unknown/pending flags. The old source media routes redirect to their derivative routes, so the integrated service never returns the two unsanitized Monbezon originals.

The browser must still confirm decoding, zoom and H05's context/native frame. Equal raster orientation does not validate a historical reading or align a word. Source and browser reference sizes must remain explicit. Ownership: root only for this directory, tests/archives-integration and .private/archives-integration; the site conversation retains all existing reader files and services.
