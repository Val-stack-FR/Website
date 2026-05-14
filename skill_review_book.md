# Skill review — `text-to-website_book-review`

Audit of `/home/user/Website/.claude/commands/text-to-website_book-review.md` against the current state of the repo (CLAUDE.md, `books/index.json`, prerender pipeline, CSP, bilingual content) **plus** an empirical voice profile drawn from the recent edited book reviews in both English and French.

Scope:
1. What the skill does and where it has drifted.
2. EN and FR voice profiles for book reviews specifically, drawn from the actual reviews.
3. Proposed revised skill outline.
4. Verification appendix.

No skill rewrite happens here — the deliverable is review + voice material in one place.

---

## 1. What the skill is meant to do

Take arbitrary input (reading notes, draft review, bullet impressions) and produce a published book review: extract metadata, write `books/<slug>.md`, append an entry to `books/index.json`, commit and push. The review then surfaces on `books.html` (now filtered by tags, not categories), gets its own URL via the clean rewrite `/books/<slug>/` (`book-review.html?book=<slug>` still works), and `scripts/prerender.js` inlines it into the static HTML at build time.

The skill works mechanically. It misses the largest schema change (tags drive the filter), it does not produce the voice, and it under-specifies the book-review-specific moves.

---

## 2. Findings — what has drifted

### 2.1 `tags` field is missing from the skill — **largest gap**
`books/index.json` entries today include `"tags": ["PHILOSOPHY", "FUTURES"]`, and CLAUDE.md is explicit: "The `category` field is kept for compatibility with `book-review.html` but no longer drives the list page (which uses `tags` instead)." The current skill says nothing about `tags` and still describes `category` as the navigation driver. This is the single most impactful fix.

The shared canonical vocabulary (also used by essays and research) is:
`"AI" · "PHILOSOPHY" · "LINGUISTIC" · "CHANGE MANAGEMENT" · "FUTURES" · "STRATEGY" · "CRISIS" · "LEADERSHIP"`.

Books use **UPPERCASE** casing (verified across `books/index.json`); essays use lowercase. The skill should restrict suggestions to the canonical vocabulary and preserve uppercase casing for books.

### 2.2 `category` is described as primary — it is now compatibility-only
The skill's step 2 says: *"Category — `Sci-Fi` or `Personal Development` (or any new category — it becomes a new tab automatically)."* This is no longer true. Keep `category` in the schema for back-compat, but stop describing it as a navigation driver. Tabs are tag-driven.

### 2.3 `rating` says "integer" — decimals exist
The skill says "1 to 5 (integer)". The registry data and CLAUDE.md allow decimals (e.g. `3.5`). Update wording to "1 to 5, decimals allowed".

### 2.4 Voice & register is absent
No section in the skill tells the model how to write a Valérian-style book review. This is critical, because the book-review form has its own moves on top of the general essay voice (treat the book as a thinking partner, minimal plot summary, sci-fi as serious philosophy, end on a question retournée au lecteur). §3 below supplies the empirical profile.

### 2.5 Bilingual handling is unmentioned
FR book reviews exist (corpus includes *Blindsight*, *Multipliers*, *Good Power* and others in French). The skill says nothing about language detection or French typographic conventions. FR reviews appear to live under `books/fr/<slug>.md` — verify path on the routing side (see §4).

### 2.6 Prerender pipeline not mentioned
`scripts/prerender.js` generates per-slug static pages under `books/<slug>.html` at build time. The skill should reassure the model that **no HTML emission is needed** — markdown + registry entry is enough.

### 2.7 CSP / inline-style hygiene
Same rule as essays: strip any `style="…"` attribute or inline event handler from pasted content before writing the markdown. The skill's class-based wrappers (`<div class="pull-quote">`, `<span class="highlight">`, `<div class="references">`) are CSP-safe; pasted-in inline styles from Notion / Google Docs are not.

### 2.8 `related` is a plain slug array — keep, but call out the difference from essays
Books use `"related": ["other-book-slug"]` — plain strings. Essays use `[ { "type": "essay", "slug": "…" } ]` — objects. The skill is currently correct for books, but worth an explicit one-line callout so the model doesn't carry essay conventions across when both skills are used in the same session.

### 2.9 No cross-medium related items
If a book pairs strongly with an essay or a research node, there is currently no documented mechanism in the book schema. Two options for later:
- Add `relatedEssays: ["slug"]` and `relatedResearch: ["slug"]` arrays, then surface them in `js/book-review.js`.
- Or: use the same `article-ref` inline mechanism as essays (renderer at `js/book-review.js` would need to mirror `js/essay-detail.js:212-240`).

Flag as: out of scope for the skill, but worth raising before the next rewrite.

### 2.10 Epigraph rule is good — keep verbatim
"Do not include an epigraph in the markdown — the book-review template does not render one. If there's a compelling quote, put it in a pull-quote instead." Verified against the current template behaviour. Keep.

### 2.11 URL to report at the end
The skill reports `book-review.html?book=<slug>`. Canonical: `https://valerianteissier.com/books/<slug>/` (apex + clean rewrite per `vercel.json` and `sitemap.xml`).

### 2.12 Commit / push behaviour
Same as essay skill: stage **only** the two expected files (`books/<slug>.md` and `books/index.json`), never assume `main`, branch convention is `claude/<feature-name>`, ask before pushing if other things are dirty.

---

## 3. Empirical voice profiles for book reviews

Both profiles below are drawn from the actual edited reviews and from the broader corpus voice (which book reviews share). They keep Valérian's general blog voice and add the moves that are book-review-specific.

### 3.1 EN voice — book reviews

All of the general EN voice applies (declarative openings, em-dash density, "not X but Y", sparse functional italics, observation → tension → resolution, long-then-short rhythm, British spelling, no marketing register). The book-review-specific moves on top:

**Treat the book as a thinking partner, not a product.** The review's job is to surface the question the book is actually wrestling with, then test what happens when you carry that question into the reader's life. The book *acts on* the reader — it perturbs, names, scalpels, mirrors. It does not "deliver value".

**Plot summary is minimal.** A paragraph at most, only enough to ground the reader. Across the corpus the opening framing of a novel runs ~30 words:
- "The crew of the *Theseus* encounters something vast and utterly alien at the edge of the solar system — and Watts uses the encounter as a scalpel to dissect what consciousness *actually* is."

For non-fiction, skip plot entirely — open directly on the framework or the question:
- "Wiseman draws a sharp line between two archetypes: the Diminisher … the Multiplier …"
- "The real question of the book isn't 'how do I become a better leader?'. It's more uncomfortable: what if your intelligence — the very thing that got you here — is precisely what's holding your team back?"

**Spend the word count on cognitive renegotiation.** What does the book ask the reader to revise? Surface that. Test it. Hold its strongest version, then say what survives.

**Sci-fi as serious philosophy, not escapism.** When reviewing fiction, read it as a thought experiment about a present-day problem. The Watts review explicitly does this: the novel becomes a laboratory for thinking about systems that are intelligent without being conscious. Do not apologise for the genre. Do not describe sci-fi as "engaging" or "imaginative" — describe what it lets you see that direct argument cannot.

**Extract operative concepts, name them.** Across the corpus, every non-fiction review extracts 2–4 named frameworks from the book and uses them as section headings:
- *Multipliers*: "The 2X Effect" · "Ownership, Not Delegation" · "The Lazy Way"
- *Good Power*: "The Velvet Hammer" · "The Boundary Paradox" · "Modernising Your Greatness"

This is the review's primary structural device. The headings tell the reader what they will take away — operationally — before they read a word of the body.

**Close by handing the question back.** Reviews end by transposing the book's question onto the reader's own life and refusing to answer for them:
- "If you stripped away today — the degree, the title, the institutional affiliation — which of your current capabilities would still make you indispensable? Those that survive are worth developing. Those that don't are worth ceasing to defend."
- "*Blindsight* is neither warning nor reassurance. It's a rigorous thought experiment about the nature of intelligence, that has you reconsidering assumptions you didn't know you were making."

Never close with a star-rating sentence or a "would recommend" line. The rating lives in metadata only.

**Quotation discipline.** Pull-quotes from the book itself are good — they let the book speak in its own register and break up dense argument. Always attribute. Do not embed long block quotes in body prose; use the `<div class="pull-quote">` wrapper.

**Banned register** (same as essays, with book-review-specific additions): no *must-read*, *essential reading*, *page-turner*, *unputdownable*, *thought-provoking* (overused), *5 stars / 4 stars* in prose, *I couldn't put it down*. The rating sits in metadata; the prose argues.

### 3.2 FR voice — book reviews / recensions

Tout le profil FR général s'applique (ouvertures déclaratives, tiret cadratin, « non pas X mais Y », italiques fonctionnelles, observation → tension → résolution, typographie française stricte, lexique évité). Surcouche spécifique aux recensions :

**Le livre comme partenaire de pensée.** Traitez le livre comme un partenaire de pensée, non comme un produit. La recension doit faire émerger la question que le livre travaille réellement, puis tester ce qui se passe quand on transporte cette question dans la vie du lecteur. Le livre *agit sur* le lecteur — il perturbe, nomme, scalpe, renvoie en miroir.

**Résumé d'intrigue minimal.** Un paragraphe au plus, juste de quoi ancrer le lecteur. Le corpus le fait en moins de trente mots :
- « Un roman de premier contact dans lequel les extraterrestres sont fondamentalement moins effrayants que la question qu'ils nous forcent à nous poser sur nous-mêmes. »

Pour la non-fiction, ouvrez directement sur le framework ou sur la question retournée :
- « La vraie question du livre n'est pas « comment devenir un meilleur leader ? ». Elle est plus inconfortable : et si votre intelligence — celle-là même qui vous a amené jusqu'ici — était précisément ce qui freine votre équipe ? »
- « La question centrale du livre n'est jamais posée frontalement — ce qui est, en soi, un choix. »

**Renégociation cognitive.** Consacrez le reste de la longueur à la renégociation cognitive que le livre demande. Que doit le lecteur réviser ? Faites-le émerger. Testez-le dans sa version la plus forte. Dites ce qui survit au test.

**SF lue comme philosophie sérieuse.** La science-fiction se lit comme de la philosophie sérieuse, pas comme une évasion. Le roman devient laboratoire de pensée appliqué à un problème contemporain. Ne vous excusez pas du genre. N'écrivez jamais « captivant », « immersif », « palpitant ». Décrivez ce que la SF permet de voir et qu'aucun argument direct ne permet de voir.

**Extraire et nommer les concepts opératoires.** Le corpus structure systématiquement les recensions non-fictionnelles autour de 2–4 frameworks nommés, érigés en titres de section :
- *Multipliers* : « The 2X Effect » · « Ownership, Not Delegation » · « The Lazy Way »
- *Good Power* : « The Velvet Hammer » · « The Boundary Paradox » · « Modernising Your Greatness »

Les titres de section disent au lecteur ce qu'il emportera — opérationnellement — avant même qu'il lise le corps. Notez que les titres restent souvent en anglais pour les frameworks anglophones — ce n'est pas un calque, c'est un choix : le terme est la marque conceptuelle de l'auteur, le traduire reviendrait à le diluer.

**Conclure en renvoyant la question.** Les recensions terminent en transposant la question du livre sur la vie du lecteur et en refusant d'y répondre à sa place :
- « La question qu'elle laisse ouverte mérite d'être testée contre votre propre parcours : si vous dépouilliez aujourd'hui — le diplôme, le titre, l'affiliation institutionnelle — lesquelles de vos capacités actuelles feraient encore de vous quelqu'un d'indispensable ? Celles qui subsistent sont celles qui méritent d'être développées. Celles qui ne subsistent pas sont celles qu'il faut cesser de défendre. »
- « *Vision Aveugle* n'est ni un avertissement ni un réconfort. C'est une expérience de pensée rigoureuse sur la nature même de l'intelligence, qui vous amène à reconsidérer des postulats que vous ignoriez même avoir adoptés. »

Jamais une phrase finale du type « à lire absolument », « livre incontournable », « 4 étoiles ». La note vit en metadata ; la prose argumente.

**Discipline de la citation.** Les pull-quotes tirées du livre sont bienvenues — elles laissent le livre parler dans son registre propre et brisent un passage analytique dense. Toujours attribuer. Pas de citation bloc longue dans le corps de la prose ; utiliser `<div class="pull-quote">`.

**Registre interdit (spécifique recensions)** : *incontournable · indispensable · à lire absolument · captivant · immersif · palpitant · prenant · brillant (comme épithète) · révélateur* (en sens galvaudé). Vérifié absent du corpus.

**Typographie.** Mêmes règles que pour les essais FR : espaces insécables avant `: ; ? !`, guillemets `« … »`, tiret cadratin `—`. Le corpus actuel les applique de manière irréprochable.

---

## 4. Proposed revised skill outline

1. **Get the content.** Use `$ARGUMENTS` if it contains review text; otherwise ask the user to paste it.
2. **Detect language.** EN or FR. Apply §3.1 or §3.2 as a hard constraint. Runs before any drafting.
3. **Extract / infer metadata.** Confirm anything inferred.
   - `title`, `slug` (kebab-case), `author`, `published` (integer year).
   - `category` — kept for back-compat ("Sci-Fi" / "Personal Development" / etc.). **Not** the navigation driver.
   - `subcategory` — free text ("Hard SF", "Systems", "Psychology", "Management").
   - `readDate` — `YYYY-MM`, default current month.
   - `rating` — 1 to 5, decimals allowed.
   - `initials` — 2 characters for the cover placeholder.
   - **`tags`** — 1–3 from the canonical vocabulary (`"AI"`, `"PHILOSOPHY"`, `"LINGUISTIC"`, `"CHANGE MANAGEMENT"`, `"FUTURES"`, `"STRATEGY"`, `"CRISIS"`, `"LEADERSHIP"`). **UPPERCASE** per `books/index.json`. These drive the filter bar.
   - `description` — one sentence for the list card (the book's core proposition, not a plot summary).
   - `note` — 1–2 sentences for the hover overlay (more personal, punchy).
   - `related` — array of plain slug strings (book slugs only). Different shape from essays.
4. **Convert the body to Markdown.**
   - `## Section title` for sections (auto §-prefixed in UI). For non-fiction: prefer named-framework headings (see §3).
   - Wrappers: `<div class="pull-quote"><blockquote>…</blockquote><cite>…</cite></div>`, `<span class="highlight">…</span>`, `<div class="references">…</div>`.
   - **No epigraph block** at the top — the template does not render one. Put a compelling quote in a pull-quote instead.
   - Strip any pasted `style=` attributes or inline event handlers.
   - Apply the voice profile from step 2 throughout, including the book-review-specific moves (minimal plot summary, named frameworks as headings, hand the question back at the close).
5. **Write the markdown file.** `books/<slug>.md` for EN; `books/fr/<slug>.md` for FR (verify path on the routing side first — see §5). No frontmatter. No HTML page emission — the prerender pipeline handles per-slug pages.
6. **Append the registry entry** to `books/index.json`:
   ```json
   {
     "slug": "...",
     "title": "...",
     "author": "...",
     "published": YYYY,
     "category": "...",
     "subcategory": "...",
     "readDate": "YYYY-MM",
     "rating": N,
     "initials": "XX",
     "tags": ["..."],
     "description": "...",
     "note": "...",
     "related": ["..."]
   }
   ```
7. **Stage, commit, push.** Stage only the two expected files. Commit message: `Add book review: <title>`. Push to the current `claude/<feature>` branch — never assume `main`. Ask before pushing if the working tree has anything else dirty.
8. **Report.** Live URL: `https://valerianteissier.com/books/<slug>/`. The tag filters it will appear under in `books.html`. Anything inferred.

---

## 5. Verification appendix (run before applying changes)

```bash
rg "tags" js/books.js css/books.css                       # confirm tags drive the filter UI as CLAUDE.md claims
rg "books/fr" vercel.json js/                             # confirm FR routing path
rg "PRERENDER:KEY" scripts/prerender.js                   # confirm sentinel format used today
tail -n 60 books/index.json                               # lock canonical tag casing and any new fields
rg "article-ref|relatedEssays|relatedResearch" js/book-review.js  # confirm/deny cross-medium links
head -n 5 sitemap.xml                                     # confirm apex host for the Report URL
```

These six checks catch any drift between this review and the live repo at the moment of the rewrite.

---

## 6. Critical files (read by this review, modified later)

Read here:
- `/home/user/Website/.claude/commands/text-to-website_book-review.md`
- `/home/user/Website/CLAUDE.md`
- `/home/user/Website/books/index.json`
- Recent EN reviews under `/home/user/Website/books/`
- Recent FR reviews under `/home/user/Website/books/fr/`

Modified later (not by this review):
- `/home/user/Website/.claude/commands/text-to-website_book-review.md` — rewrite using §4 + §3.1 + §3.2.
