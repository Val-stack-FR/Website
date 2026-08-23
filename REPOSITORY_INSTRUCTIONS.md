# Website — repository instructions

## Scope and workflow

This repository publishes Valérian Teissier's static portfolio, essays, book reviews and research. The reading library is deliberately unpublished. Work from a fresh feature branch; preserve unrelated changes; prepare pull requests for review and never merge them automatically.

The public deployment is built with `node scripts/build-site.js` into `dist/`. Only deployable public assets belong there; repository instructions, workflows, synchronisation scripts, package files and development configuration must remain outside it.

## Content, privacy and SEO

- The canonical host is `https://valerianteissier.com`.
- Content intended for discovery must be rendered to static HTML. Existing French translations must use real `/fr/.../` routes, reciprocal `hreflang`, a self canonical, French metadata and `inLanguage: fr`.
- Do not invent credentials, awards, affiliations, dates or citations.
- The reading-library source and its Google workbook are out of scope for public deployment. Do not restore a public mirror, log or expose workbook fields, or alter workbook sharing/publication settings.

## Security

- No inline scripts, inline styles or inline event handlers.
- Keep CSP free of `unsafe-inline` and `unsafe-eval`; explicitly permit only required origins.
- Pin GitHub Actions by immutable SHA and keep dependency lockfiles current.
- Validate that `dist/` excludes repository internals before publishing.

## Quality and continuity

- Keep `todo.md` current at each material checkpoint.
- When a model family resumes substantial work from another family, run an adversarial pass before extending it and record the result in the PR or task record.
- Treat an exploration as distinct from a completed decision. Prefer small, reviewable commits and evidence-based validation.

