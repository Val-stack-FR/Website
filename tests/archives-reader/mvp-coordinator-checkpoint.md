# Coordinator checkpoint — 3 October 2026

The local reader MVP is accepted within its stated scope: two consultation dossiers, the literal Monbezon transcription and two verified JPEGs; E.108 has no assigned photograph. Translation is absent, not generated. No new canonical act or historical validation is claimed.

Evidence:

- Import verification: the bounded mvp-i2-monbezon run preserves three original hashes and bytes; six repeat outputs are identical. Eighteen importer tests and schema/reference checks pass.
- Browser QA: Chrome desktop and 390 × 844 mobile, direct links, horizontal navigation, keyboard, zoom/focus, two images decoded at 3968 × 2976; no console errors.
- HTTP check: both image responses match the input SHA-256 and MIME/byte size; private repository paths return 404.
- Independent integrated review reproduced and fixed an output-junction escape and inconsistent preflight/size claims.
- The coordinator then bound startup to the exact source-manifest hash checked by preflight and verified each selected image against its authorized input entry.
- Eight server/build tests pass, plus the renderer suite. Full existing website build passed with a process-local npm runtime. No private corpus/fixture HTML is in dist/.

The preview was restarted after these checks. It binds only 127.0.0.1 and exposes explicit assets and selected image hashes.

Not covered: public deployment, hosted correction persistence, real owner authentication, historical reading approval, canonical research closeout, other browsers or a real screen reader. The research runs retain their missing session-URL limitation.

Next increments stay small: one synthetic persistent correction passage; five M2 fiches for semantic search; their reviews precede wider import or release.

## Bounded annex search integration

The same five-fiche index now renders at /archives/recherche/. Its two CSS/JS assets are explicit optional preview routes; the raw index and private output path return 404. The coordinator read the renderer/filter/validation and identified an obligatory private-file dependency in its tests. This was replaced with a wholly synthetic fixture; the real integration test requires an explicit environment path and skips honestly when absent.

Coordinator tests: default 4 pass/1 optional skip, explicit real index 5 pass. Optional preview-route tests pass. The full website build was repeated after adding the two deployable assets: 106 files, zero private/internal outputs and zero archive pages published. The earlier 104-file result remains the first checkpoint, before these assets existed. Browser QA for this small search UI is recorded separately.
