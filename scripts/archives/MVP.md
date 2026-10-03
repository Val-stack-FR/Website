# Verification MVPs

This increment is local. It is not the public Archives release.

## Minimal shared contract

- Research IDs stay in PHD-Maine. A consultation candidate is not a newly identified act.
- The import profile is atelier-tuce-reader/0.1.0. Candidate text/date/view references resolve by ID.
- A photograph appears only when the candidate declares it and an accepted link connects that exact transcript source to that image endpoint.
- Text revision is its SHA-256. Language, reading status, identification and publication remain separate.
- Translation may be absent. Dates and conflicting expressions remain literal and sourced.
- View type is not guessed. The public label “dos” maps to verso when attested.
- The private media sidecar is atelier-tuce-local-media/1.0.0; paths are relative to env:PHD_CORPUS_ROOT.
- The renderer writes only explicitly private, ignored output. The localhost preview reads only selected, hash-verified JPEGs after a passed preflight.
- No historical confirmation is produced by this renderer or preview server.

## Reproducible consultation

1. Obtain a bounded export, media allowlist and passed preflight from the importer.
2. Render with scripts/archives/render-reader.mjs using --input, --output, --media-mode local-preview and --private-preview.
3. Configure PHD_CORPUS_ROOT locally; do not commit its value.
4. Run scripts/archives/preview-server.mjs with --html, --media-manifest, --preflight, --source-manifest and --port. The source manifest must match the exact hash checked by preflight, and the selected images must match its authorized entries.
5. Check direct links, horizontal navigation, mobile layout, image decoding/zoom, source hashes and private-route refusal.

Only these public paths are available in the preview: /archives/, /styles.css, /css/archives.css, /js/archives-reader.js, /favicon.svg and selected /__archive_media/<sha256> URLs. With the explicit --search-html private page option, /archives/recherche/ and its two dedicated CSS/JS assets are also available. With --status-html, /archives/avancement/ and /css/archives-statusboard.css are available. The raw indexes and exports are never served. Use both optional page arguments for the integrated preview navigation.

The annex renderer scripts/archives/render-annex-search.mjs reads only the bounded private index and writes HTML to stdout. Save this output under the validated private checkout directory before adding --search-html. This UI stays on the same five selected fiches; no wider absence, identity or historical title confirmation is implied.

The statusboard renderer scripts/archives/render-statusboard.mjs takes --reader and --annex and emits static HTML to stdout. Save it under the same validated private checkout before adding --status-html. Exactly two consultation dossiers and five editorial fiches are allowed. Their states, priority reasons, blockers and next actions remain distinct; no percentage of the whole fonds is inferred.

## Passage to the next increment

- Import: unchanged sources, stable IDs, preserved decisions, repeatable output and valid references.
- Consultation: two real source images correctly associated, no fabricated E.108 association, navigation verified.
- Memory: independent review of the synthetic loop, idempotent decisions and no promotion of unreviewed corpus.
- Public corrections: require a separate persistent/authenticated MVP; not implemented here.
- Public release: requires a deployable corpus/media release, full build verification and repository review workflow. The fixture and private preview must stay outside dist/.

Operational research closeout and historical validation remain separate from functional test results.
