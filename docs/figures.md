# Figures, images, tables and lists in essays

Canonical conventions for anything visual or structured inside an essay (figures, images, tables, lists, links to other essays). Check your work with `node scripts/check-figures.js` (no dependency; exits 1 on any error). Security rules from `REPOSITORY_INSTRUCTIONS.md` apply: no inline style, script or event handler, anywhere, SVG included; CSP stays as in `vercel.json` (`img-src 'self' data:`).

## Files

```
essays/figures/<id>.<lang>.svg                 current flat layout (first three figures)
essays/figures/<essay-slug>/<id>.<lang>.svg    new figures: one folder per essay
essays/figures/<essay-slug>/<id>.<lang>-<w>.webp   raster, one file per width (e.g. -480, -800, -1200)
```

- `<lang>` is `fr` or `en`. Every file carrying text exists in both languages. A language-neutral image (no text) has no `<lang>` and is shared.
- `essays/` is copied as is into `dist/`, so the public URL is `/essays/figures/...` (absolute path, required by the legacy route `essay-detail.html?essay=<slug>`, which renders the Markdown in the browser).
- Source data, build scripts and notebooks stay outside this repository; only the final asset is committed.

## Markdown block

Paste the block in `essays/<slug>.md` and `essays/fr/<slug>.md` between two blank lines, **with no blank line inside** (`scripts/prerender.js` splits on blank lines and copies any block starting with `<`). No Markdown inside the block (the static renderer and the legacy `marked` route do not treat it identically): use `<strong>`, `<em>` and plain text.

```html
<figure class="essay-figure">
  <img src="/essays/figures/<slug>/<id>.en.svg" alt="What a reader who cannot see it needs to know." width="460" height="361" loading="lazy" decoding="async">
  <figcaption><strong>Figure 1. Title.</strong><details class="essay-figure-long"><summary>Caption and sources</summary>What it shows, values, scope and caveats. <span class="essay-figure-source">Source: author (year), publication, table or page.</span></details></figcaption>
</figure>
```

Rules: `alt` is always present and describes the content (at least a full sentence; the checker rejects very short alts); `width` and `height` are the intrinsic size (no layout shift); `loading="lazy"`; `<figcaption>` with number and title always visible, and the full caption plus source line inside a collapsed `<details class="essay-figure-long">` (desktop and mobile; the text stays in the static HTML, so crawlers and screen readers read it, and `summary` is keyboard-operable). The caption states data source, population, period, and whether values are self-reported or derived. French: `<summary>Légende et sources</summary>`. Numbers, alt and captions are never edited here if they come from a research card: change them at their source (wrapping the caption in the `<details>` does not change its text). The image is centred in the text column.

### Variants (classes on `<figure>`)

| Class | Use |
|---|---|
| `essay-figure` | default: image up to 520 px wide (SVG drawn at 460 units wide) |
| `essay-figure essay-figure--raster` | raster photo or chart at its natural size, never upscaled, never wider than the column |
| `essay-figure essay-figure--wide` | fills the text column (about 596 px desktop, about 350 px at 390 px) |
| inside the figure: `<div class="essay-figure-panels">` with several `<img>` | two panels side by side on desktop, stacked on mobile |

### Raster images

Prefer WebP (PNG for sharp line art, JPEG for photographs). Provide three widths and let the browser choose; keep each file under 300 KB (checker error) and ideally under 200 KB:

```html
<img src="/essays/figures/<slug>/<id>.en-800.webp"
     srcset="/essays/figures/<slug>/<id>.en-480.webp 480w, /essays/figures/<slug>/<id>.en-800.webp 800w, /essays/figures/<slug>/<id>.en-1200.webp 1200w"
     sizes="(max-width: 768px) 350px, 596px"
     alt="..." width="800" height="450" loading="lazy" decoding="async">
```

`width`/`height` are those of the `src` file. Text rendered inside a raster is a last resort: it must be legible at 350 px wide, and the same information goes in the caption.

### Illustrated tables

Real tables stay HTML tables (readable by screen readers and crawlers), wrapped so they scroll on mobile instead of widening the page:

```html
<div class="essay-table" role="region" aria-label="Table 1. Title" tabindex="0">
  <table>
    <caption><strong>Table 1. Title.</strong> Source and caveats.</caption>
    <thead><tr><th scope="col">...</th></tr></thead>
    <tbody><tr><td>...</td></tr></tbody>
  </table>
</div>
```

The wrapper takes the keyboard focus (`tabindex="0"`) so that the scrollable area is reachable; the site's global `:focus-visible` outline applies. Do not use a table for layout.

## SVG charts

- Drawn on `#f9f6f1` (`--surface-2`) with the essay palette: text `#111810` (`--text`), accent `#1a5c3a` (`--accent-dark`), secondary text no lighter than `#565a53`, neutral `#6b7168`, rules `#80867d`. Check 4.5:1 for text and 3:1 for graphical marks against the background. Do not invent new colours.
- Attributes only: `fill`, `stroke`, `font-family`, `font-size`... never `style=` or `<style>`; no `<script>`, `<image>`, `<foreignObject>`, `@import`, external `href`.
- Root element: `viewBox`, `role="img"`, `<title>` and `<desc>` (same text as the `alt` / caption start), `lang`.
- Fonts: an SVG loaded by `<img>` cannot use the site's web fonts; text falls back to the first installed font of the list (`'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif`). Keep text at 14 units or more for a 460-unit viewBox (about 10.6 px at 350 px wide).
- Weight: 30 KB maximum (checker error).
- Information is never carried by colour alone: add direct labels, values, patterns or position. Use one accent colour plus neutrals when the data allows.
- Not focusable, no links, no animation.

## Lists and links

Lists are written in Markdown, one item per line, **with no blank line between items** (a blank line ends the list: `scripts/prerender.js` splits the text on blank lines, so each separate block would become its own list).

```
- First parallel item.
- Second item that wraps on
  two lines (an indented line continues the item).
- Third item.
```

Ordered lists use `1. `, `2. `... Styling uses the essay tokens: 15 px, `--text-muted`, 1.9 line height, 10 px between items, bullet or number in `--accent-dark`, indent 1.4 em (about 21 px at 390 px). Nested lists are written in HTML (`<ul>` inside the `<li>`). Footnote markers (`<span class="fn">[n]</span>`) and `**bold**` work inside items. The legacy route (`marked@9.1.6`) produces the same `<ul>`/`<ol>` structure.

Links to another essay:
- a standalone cross-reference card: `<div class="article-ref" data-slug="<slug>" data-type="essay">One bridging sentence.</div>`; the build resolves it to the French page in the French file;
- an inline link: `[text](/essays/<slug>/)` in the English file and `[texte](/fr/essays/<slug>/)` in the French file. A link starting with `/` opens in the same tab; an external `http(s)` link opens in a new tab with `rel="noopener"`. Links in paragraphs and list items are underlined in `--accent-dark`.

Stable URL formats: English `/essays/<slug>/`, French `/fr/essays/<slug>/` (real static folders; no rewrite in `vercel.json`; reciprocal `hreflang` in the page and `sitemap.xml`). The slug is the file name in `essays/index.json`.

## Accessibility checklist

1. `alt` states the finding or the content, not "chart".
2. Caption (in the collapsed `<details>`) restates values for anyone who cannot read the image.
3. Contrast: text 4.5:1, marks 3:1; caption text uses `--text`, not `--text-muted` (about 4.3:1 on the essay background).
4. Figures have no tab stop; only scrollable tables do.
5. Check at 390 px and 1280 px: no horizontal page scroll, text legible.
6. French and English versions have the same figures, same numbers, translated alt and captions.

## Theme, print, mobile

- The site has no dark mode (`prefers-color-scheme` is absent from the repository). Figures are framed on `--surface-2`, so they stay readable on the light page. If a dark theme is introduced, SVGs need their own variants (an `<img>` cannot inherit CSS variables).
- Print: `.essay-figure` and `.essay-table` avoid page breaks inside. There is no other print stylesheet.
- Mobile (at most 768 px): margins shrink, panels stack, tables scroll inside their wrapper.

## Verification

```
node scripts/check-figures.js                                 # files, alt, sizes, FR/EN pairs, CSP-forbidden constructs (also run first by build-site.js: an error fails the build)
SITE_ROOT=<temp copy> node scripts/prerender.js               # static render keeps every <figure> as is
node scripts/build-site.js                                    # dist/essays/figures/ contains every asset
```

Also open `/essays/<slug>/`, `/fr/essays/<slug>/` and `essay-detail.html?essay=<slug>` at 390 px and 1280 px and check the console for CSP violations.

## Known design-system inconsistencies (not changed here)

- Two palettes: `essay-detail.css` redefines `:root` (`--accent #2c8a52`, `--bg #f5f1eb`, `--border-solid` at 0.15) over `styles.css` (`--accent #1a5c3a`, `--bg #e8f2ed`, `--border-solid` at 0.18). Figures follow the essay palette.
- `--text-muted` (58 % opacity) is about 4.3:1 on the essay background and `--text-dim` (32 %) is much lower: references (`.reference-item`) use `--text-dim`, below WCAG AA.
- Text colours are partly expressed as alpha tokens, which makes contrast depend on the background; figures use opaque colours instead.
- Caption sizes are 12 px (figures, tables) against 10-11 px for references and footnote markers.
