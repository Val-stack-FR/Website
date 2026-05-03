# text-to-website_essay

Convert the provided text into a new essay for the website. The input can be any format: rough notes, a polished draft, a pasted article, bullet points, etc.

## Steps

### 1. Get the content
If `$ARGUMENTS` contains essay text, use it. Otherwise, ask the user to paste the content they want to publish.

### 2. Extract or infer metadata
Read the content carefully and determine (or ask the user if unclear):
- **Title** — clear, sharp, in the site's style (lowercase except first word, colon for subtitles)
- **Slug** — URL-friendly version of the title (lowercase, hyphens, no special chars)
- **Date** — publication date (default to today: use the current date)
- **Tags** — 1–3 tags from: AI, R&D, CIR, change management, futures, strategy, technology (infer from content, confirm if unsure)
- **Reading time** — estimate at ~200 words/minute, round to nearest minute (e.g. "7 min")
- **Description** — one tight sentence summarising the essay's argument (not the topic — the *argument*)

### 3. Read the existing essays
Read `essays/index.json` in full. Two goals:
1. Find the current highest `num` value and increment it by 1, zero-padded to 2 digits (e.g. "03").
2. Note the slug, title, tags, and description of every existing essay — you will use these in Step 4 to identify cross-essay links and in Step 6 to choose related essays.

### 4. Convert the body to Markdown
Rewrite the content in clean Markdown following the site's conventions:

- Use `## Section title` for main sections (they auto-get a § prefix in the UI)
- Wrap pull quotes: `<div class="pull-quote"><blockquote>"Quote text."</blockquote><cite>— Source</cite></div>`
- Wrap footnote markers: `<span class="fn">[1]</span>` inline in text
- Wrap inline highlights: `<span class="highlight">text</span>`
- Put references at the end in a `<div class="references">` block with `.reference-item`, `.ref-num`, `.ref-text` structure
- Keep the prose voice consistent with the existing essays: first-person, direct, field-observation style. Tighten and sharpen where needed — don't pad.

**Bibliography completeness — required for every reference:**
- Academic papers: find and include the DOI as `https://doi.org/<doi>`. Use WebSearch (`"<author> <year> <title> doi"`) for any DOI you don't know with certainty. If a DOI genuinely cannot be found after one search, append `(DOI not found)` inline so the gap is visible.
- HBR / McKinsey / Gallup / company reports: include the direct URL to the article or report page.
- Books: include publisher URL or ISBN when readily findable.
- Videos (YouTube, conference talks): include the direct URL.
- Anonymised or proprietary sources (`Anon.`): no DOI expected — leave as-is.
- Do NOT use cross-essay references as numbered footnotes in the bibliography block (see below).

**Cross-essay linking — check after drafting prose:**
- Compare each section of the essay against the existing essays noted in Step 3. Where the argument explicitly builds on, contrasts with, or extends another essay's findings, insert an `article-ref` div at the natural point in the prose:
  ```html
  <div class="article-ref" data-slug="<slug>" data-type="essay">
    One sentence contextualising why this essay is relevant here.
  </div>
  ```
- Aim for 0–2 such references per essay. Do not force them if the connection is weak.
- If the essay is created in French, apply the same `article-ref` divs using the same slugs — the router handles both languages.

### 5. Write the essay file
Create `essays/<slug>.md` with the converted Markdown body (no frontmatter — metadata lives in index.json).

### 6. Update the registry
Add a new entry to `essays/index.json` at the **end** of the array:
```json
{
  "slug": "<slug>",
  "num": "<num>",
  "title": "<title>",
  "date": "<YYYY-MM-DD>",
  "tags": ["<tag1>", "<tag2>"],
  "readTime": "<X min>",
  "description": "<description>",
  "related": [
    { "type": "essay", "slug": "<slug-of-related-essay>" }
  ]
}
```
Choose 1–3 existing essays whose theme significantly overlaps with the new essay and add them to `related`. Use `[]` if no strong connection exists. The frontend renders these automatically as "Read next" cards — no JS changes needed.

### 7. Commit and push
Stage both files, commit with message `Add essay: <title>`, and push to the current branch.

### 8. Report
Tell the user:
- The essay is live at: `essay-detail.html?essay=<slug>`
- The slug and tags used
- If anything was inferred (date, tags, reading time), mention it so they can correct if needed
