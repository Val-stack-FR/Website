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

### 3. Determine the next essay number
Read `essays/index.json` to find the current highest `num` value. Increment by 1, zero-padded to 2 digits (e.g. "03").

### 4. Convert the body to Markdown
Rewrite the content in clean Markdown following the site's conventions:

- Use `## Section title` for main sections (they auto-get a § prefix in the UI)
- Wrap pull quotes: `<div class="pull-quote"><blockquote>"Quote text."</blockquote><cite>— Source</cite></div>`
- Wrap footnote markers: `<span class="fn">[1]</span>` inline in text
- Wrap inline highlights: `<span class="highlight">text</span>`
- Put references at the end in a `<div class="references">` block with `.reference-item`, `.ref-num`, `.ref-text` structure
- Keep the prose voice consistent with the existing essays: first-person, direct, field-observation style. Tighten and sharpen where needed — don't pad.

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
  "description": "<description>"
}
```

### 7. Commit and push
Stage both files, commit with message `Add essay: <title>`, and push to the current branch.

### 8. Report
Tell the user:
- The essay is live at: `essay-detail.html?essay=<slug>`
- The slug and tags used
- If anything was inferred (date, tags, reading time), mention it so they can correct if needed
