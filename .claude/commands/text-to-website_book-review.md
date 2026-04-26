# text-to-website_book-review

Convert the provided text into a new book review for the website. The input can be any format: reading notes, a draft review, bullet-point impressions, a pasted write-up, etc.

## Steps

### 1. Get the content
If `$ARGUMENTS` contains review text, use it. Otherwise, ask the user to paste the content they want to publish.

### 2. Extract or infer metadata
Read the content and ask the user for anything that can't be inferred:
- **Book title** — exact title of the book
- **Slug** — URL-friendly version of the title (lowercase, hyphens, no special chars)
- **Author** — full author name
- **Published** — year the book was published (integer)
- **Category** — `"Sci-Fi"` or `"Personal Development"` (or any new category — it becomes a new tab automatically)
- **Subcategory** — e.g. `"Hard SF"`, `"Systems"`, `"Psychology"`, `"Management"` (shown in meta)
- **Read date** — month and year read, in `YYYY-MM` format (default to current month/year)
- **Rating** — 1 to 5 (integer)
- **Initials** — 2 characters for the cover placeholder (typically first 2 letters of the title)
- **Description** — one sentence for the list card (the book's core proposition, not a plot summary)
- **Note** — 1–2 sentences for the hover overlay on the book card (more personal, punchy)
- **Related** — array of slugs of other books already in `books/index.json` that pair well with this one (can be empty `[]`)

### 3. Convert the body to Markdown
Rewrite the review content in clean Markdown following the site's conventions:

- Use `## Section title` for main sections (auto-get §01, §02 etc. prefix in UI)
- Wrap pull quotes: `<div class="pull-quote"><blockquote>"Quote."</blockquote><cite>— Source</cite></div>`
- Wrap inline highlights: `<span class="highlight">text</span>`
- Put references at the end in a `<div class="references">` block with `.reference-item`, `.ref-num`, `.ref-text` structure
- Prose style: direct, first-person, argumentative. Not a plot summary — a position. Tighten where needed.
- **Do not include** an epigraph / opening quote in the markdown — the book-review template does not render one from the markdown body. If there's a compelling quote, put it in a pull-quote block instead.

### 4. Write the review file
Create `books/<slug>.md` with the converted Markdown body (no frontmatter).

### 5. Update the registry
Add a new entry to `books/index.json` at the **end** of the array:
```json
{
  "slug": "<slug>",
  "title": "<title>",
  "author": "<author>",
  "published": <year>,
  "category": "<category>",
  "subcategory": "<subcategory>",
  "readDate": "<YYYY-MM>",
  "rating": <1-5>,
  "initials": "<XX>",
  "description": "<description>",
  "note": "<note>",
  "related": ["<slug1>", "<slug2>"]
}
```

### 6. Commit and push
Stage both files, commit with message `Add book review: <title>`, and push to the current branch.

### 7. Report
Tell the user:
- The review is live at: `book-review.html?book=<slug>`
- The category tab it appears under in `books.html`
- Any metadata that was inferred (so they can correct if needed)
