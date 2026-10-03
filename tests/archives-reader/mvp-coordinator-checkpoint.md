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
