# Valérian's Website — Claude Reference

## What this is
Personal portfolio and content site for Valérian Teissier (AI researcher / strategist, Paris). Hosts essays on AI adoption and organisational change, and book reviews in science fiction and non-fiction.

## Tech stack
**Pure static HTML/CSS/JS — no build tool, no framework, no npm.**

Content is loaded at runtime via `fetch()`. This means:
- The site **must be served over HTTP** (e.g. `python3 -m http.server 8080`), not opened as a `file://` URL.
- Fetch calls will silently fail on `file://` due to browser CORS restrictions.

## File structure

```
/
├── index.html              Homepage
├── essays.html             Essay list (dynamic, loads from essays/index.json)
├── essay-detail.html       Essay detail template (dynamic, ?essay=slug param)
├── books.html              Book list with tabs (dynamic, loads from books/index.json)
├── book-review.html        Book review template (dynamic, ?book=slug param)
├── styles.css              Shared stylesheet (tokens, layout, components)
│
├── essays/
│   ├── index.json          Essay registry — source of truth for the list page
│   └── *.md                One file per essay (Markdown + raw HTML allowed)
│
└── books/
    ├── index.json          Book registry — source of truth for the list page
    └── *.md                One file per book review (Markdown + raw HTML allowed)
```

## Adding a new essay

1. Drop `essays/<slug>.md` — body in Markdown (raw HTML OK for pull-quotes etc.)
2. Add one entry to `essays/index.json`:
   ```json
   {
     "slug": "my-new-essay",
     "num": "03",
     "title": "My New Essay",
     "date": "YYYY-MM-DD",
     "tags": ["AI"],
     "readTime": "X min",
     "description": "One sentence summary."
   }
   ```
That's it. The essay appears in the list and gets its own URL automatically.

**URL:** `essay-detail.html?essay=my-new-essay`

The detail page also supports `.html` format: if `essays/slug.md` is not found, it tries `essays/slug.html`.

## Adding a new book review

1. Drop `books/<slug>.md` — body in Markdown
2. Add one entry to `books/index.json`:
   ```json
   {
     "slug": "book-slug",
     "title": "Book Title",
     "author": "Author Name",
     "published": 2024,
     "category": "Sci-Fi",
     "subcategory": "Hard SF",
     "readDate": "2025-03",
     "rating": 4,
     "initials": "BT",
     "description": "One sentence summary for the list card.",
     "note": "Hover text shown on the book card.",
     "related": ["other-book-slug"]
   }
   ```

**URL:** `book-review.html?book=book-slug`

Categories for tabs: `"Sci-Fi"`, `"Personal Development"` (or any new category — tabs generate automatically).

## Essay markdown format

Standard Markdown. Raw HTML is supported for:
- Pull quotes: `<div class="pull-quote"><blockquote>…</blockquote><cite>…</cite></div>`
- Footnote markers: `<span class="fn">[1]</span>`
- Highlights: `<span class="highlight">…</span>`
- References block: `<div class="references">…</div>`

Section headings (`## Section title`) automatically get a § prefix and appear in the sidebar TOC.

## CSS design system

### Fonts
- `var(--font-head)` — Space Grotesk (headings, UI)
- `var(--font-mono)` — IBM Plex Mono (body, labels, meta)

### Colors (essay detail page)
- `--bg` `#f5f1eb` · `--accent` `#2c8a52` · `--accent-dark` `#1a5c3a`

### Colors (list pages)
- `--bg` `#e8f2ed` · `--accent` `#1a5c3a`

### Key layout classes
- `.essay-layout` — two-column grid (220px sidebar + 1fr), max 1100px centered
- `.review-layout` — two-column grid (280px sidebar + 1fr), max 1160px centered
- `.pull-quote` — full-bleed quote block
- `.references` — footnote list at end of content

### Breakpoints
- `768px` — mobile layout (stacked columns, reduced padding)
- `480px` — smallest mobile adjustments

## Slash commands (Claude Code skills)

Use these to publish new content directly from any text format:

- `/text-to-website_essay` — converts any text input into a properly formatted essay file and updates the registry
- `/text-to-website_book-review` — converts notes/text into a book review file and updates the registry

## File structure (scripts and styles)

```
css/
  index.css          ← index.html page styles
  essays.css         ← essays.html page styles
  essay-detail.css   ← essay-detail.html page styles
  books.css          ← books.html page styles
  book-review.css    ← book-review.html page styles
js/
  index.js           ← index.html script
  essays.js          ← essays.html script
  essay-detail.js    ← essay-detail.html script
  books.js           ← books.html script
  book-review.js     ← book-review.html script
```

Each HTML page loads `styles.css` (shared) + its own `css/<page>.css` and `js/<page>.js`.

## Security rules

The site's CSP (`vercel.json`) has no `unsafe-inline`. **Always follow these rules** when adding or editing code:

- **No inline scripts.** All JS goes in `js/<page>.js`. Never add a `<script>` block inside HTML.
- **No inline styles.** All CSS goes in `css/<page>.css` or `styles.css`. Never add a `<style>` block or `style=` attribute on an HTML element — use named CSS classes instead.
- **No inline event handlers.** Never use `onclick=`, `onmouseover=`, `onerror=` etc. in HTML. Attach all handlers via `addEventListener` in the JS file.
- **SRI on all CDN scripts.** Any `<script src="https://...">` from a CDN must include `integrity="sha384-..."` and `crossorigin="anonymous"`. Compute the hash with: `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`
- **CSP compliance.** The `vercel.json` CSP must never include `'unsafe-inline'` or `'unsafe-eval'`. When adding a new external domain (font provider, CDN), add it explicitly to the correct directive in `vercel.json`.
- **Dynamic HTML.** When generating HTML via `innerHTML` or template literals, do not embed `style=` attributes or event handler attributes in the string. Use CSS classes and event delegation instead.

## Branch convention
Work on `claude/<feature-name>` branches. Push and open PRs via GitHub MCP tools (mcp__github__*).
