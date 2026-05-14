# Skill review — `text-to-website_essay`

Audit of `/home/user/Website/.claude/commands/text-to-website_essay.md` against the current state of the repo (CLAUDE.md, the JSON registries, the prerender pipeline, the CSP, the bilingual content) **plus** an empirical voice profile drawn from the four most recent edited essays in both English and French.

Scope of this document:
1. What the skill does today and where it has drifted from reality.
2. An empirical EN voice profile and an empirical FR voice profile, drawn from the actual essays (not aspirational guidance) — the section to embed verbatim into a revised skill.
3. A proposed revised skill outline.
4. A verification appendix to run before applying changes.

No skill rewrite happens in this document. The deliverable is review + voice material, in one place.

---

## 1. What the skill is meant to do

Take arbitrary input (notes, draft, pasted article) and produce a published essay: extract metadata, write `essays/<slug>.md`, append an entry to `essays/index.json`, commit and push. The published essay then surfaces on `essays.html`, gets its own URL via the clean rewrite `/essays/<slug>/` (`essay-detail.html?essay=<slug>` still works), and `scripts/prerender.js` inlines it into the static HTML at build time.

The skill works mechanically. It does not produce the voice. And several of its assumptions are stale.

---

## 2. Findings — what has drifted

### 2.1 Voice & register is entirely absent
The single largest gap. The skill specifies fields, HTML wrappers, and a commit message. It says nothing about **how to write**, in either language. That is why output reads as competent but generic. Section 3 below supplies the EN and FR voice profiles drawn from the actual edited essays — these should be embedded in the revised skill as a non-skippable step.

### 2.2 Tag vocabulary is wrong
The canonical shared vocabulary (essays, books, research) is **UPPERCASE**:

`"AI" · "PHILOSOPHY" · "LINGUISTIC" · "CHANGE MANAGEMENT" · "FUTURES" · "STRATEGY" · "CRISIS" · "LEADERSHIP"`

The skill currently lists `AI, R&D, CIR, change management, futures, strategy, technology`. Three of those (`R&D`, `CIR`, `technology`) are not in the vocabulary; four legitimate tags (`PHILOSOPHY`, `LINGUISTIC`, `CRISIS`, `LEADERSHIP`) are missing.

Casing drift in the registry: `essays/index.json` currently contains mostly lowercase tags (`"change management"`, `"strategy"`, `"futures"`, `"philosophy"`, `"linguistic"`, `"crisis"`) with `"AI"` as the only uppercase entry. **The canonical form is UPPERCASE — the existing lowercase entries are the deviation, not the rule.** Two actions for the revised skill:

1. Always emit new entries with UPPERCASE tags from the canonical set.
2. Flag (don't silently rewrite) the legacy lowercase entries when the skill reads `essays/index.json` — a one-shot normalisation pass across both registries is the right fix, but it sits outside the per-essay skill flow.

### 2.3 Bilingual handling is one line
Only the `article-ref` section mentions French. The skill should:
- Detect input language up front.
- Apply the matching voice profile (§3.1 EN / §3.2 FR).
- For EN: enforce British spelling (organisation, optimise, recognise, behaviour, analyse). The corpus already does this consistently — confirmed across all recent essays.
- For FR: enforce French typographic conventions — tiret cadratin `—`, espaces insécables avant `: ; ? !`, guillemets français `« … »`, italiques uniquement pour notions techniques. The corpus already follows these conventions strictly.
- FR essays sit under `essays/fr/<slug>.md` (confirmed by the voice mining pass). The skill makes no mention of the `fr/` subpath.

### 2.4 Prerender pipeline not mentioned
`scripts/prerender.js` runs at build time on Vercel: it inlines essay content between `<!-- PRERENDER:KEY:START/END -->` sentinels, generates one static HTML page per essay under `essays/<slug>.html`, regenerates `llms.txt`, and validates DONE research links. The skill should explicitly reassure the model that **no HTML emission is needed** — markdown + registry entry is enough.

### 2.5 CSP / inline-style hygiene not mentioned
CLAUDE.md forbids inline scripts, inline styles, `style=` attributes, inline event handlers. The skill's HTML wrappers (`<div class="pull-quote">`, `<span class="fn">`, `<div class="references">`, `<div class="article-ref">`) are fine because they use classes. The risk is paste-in `style="…"` attributes from Google Docs / Notion exports. The revised skill should add: "strip any `style=` attribute or inline handler from pasted content before writing the markdown."

### 2.6 `num` computation is fragile
Step 3 instructs "find the current highest `num` value and increment it by 1, zero-padded to 2 digits." Two issues:
- `num` is stored as a string (`"01"`, `"02"`) — parse with `parseInt(num, 10)`, never assume array order.
- Use `max + 1`, never `count + 1`. A deletion would otherwise silently produce a duplicate.

### 2.7 Related field — cross-medium links are supported but undocumented
Today's `essays/index.json` uses `"related": [ { "type": "essay", "slug": "…" } ]`. The renderer at `js/essay-detail.js:212-240` also supports `data-type="book"` for inline `article-ref` divs **and** would support `{ "type": "book", "slug": "…" }` in `related` if entries used it (verify on the registry side before recommending widely). Worth saying so explicitly so the model doesn't shy away from cross-medium linking when it is the right move.

### 2.8 URL to report at the end
The skill reports `essay-detail.html?essay=<slug>`. The canonical URL is the apex + clean path: `https://valerianteissier.com/essays/<slug>/` (per `vercel.json` rewrites and `sitemap.xml`). Use the canonical form.

### 2.9 Commit / push behaviour
Step 7 says "Commit and push" without scoping. Today the branch convention is `claude/<feature-name>` (CLAUDE.md). The skill should:
- Stage **only** the two expected files (`essays/<slug>.md` and `essays/index.json`).
- Never assume `main`.
- Use `mcp__github__*` tools when running in MCP context, plain `git` otherwise.
- Ask before pushing if anything else in the working tree is dirty.

### 2.10 Bibliography rules — keep with minor additions
The current bibliography rules (DOI for academic papers, direct URL for HBR / McKinsey / Gallup, ISBN for books, `(DOI not found)` marker, `Anon.` for proprietary) are good. Two small additions:
- For preprints / working papers, prefer the arXiv (or SSRN) URL — DOIs there are unstable.
- Match the corpus's existing convention: cite as **Author(s). (Year). *Title*. Journal/Publisher. DOI/URL.** (verified across all four recent essays).

### 2.11 Artefact type (minor)
The file lives in `.claude/commands/`, so it is a slash-command, not a real Claude Code skill. Fine to leave as a command (it is always invoked deliberately via `/text-to-website_essay`). Noted for completeness only.

---

## 3. Empirical voice profiles — to embed verbatim in the revised skill

Both profiles below are drawn from the actual edited essays, not aspirational guidance. They keep the prose-level guidance Valérian wrote, then add the empirical patterns that show up across the corpus. The revised skill should run one of these as the *first* step after language detection.

### 3.1 EN voice — apply when input is English

**Posture.** Write as a reflective practitioner, not a critic-from-above. Direct, intellectually honest, unsentimental. Conviction is welcome; salesmanship is not. The reader should feel they are thinking with the writer, not being walked through a thesis.

**Openings.** Open paragraphs with a declarative subject — never "There is", "It is important to note", "In this essay I will". The corpus opens almost every essay with a topic-first claim that immediately problematises itself:
- "The 'AI super-user' has become the central figure of enterprise AI discourse."
- "We spent the first decade of enterprise AI asking whether the technology could do the work."
- "The numbers that open most AI adoption reports are not measuring the same thing."
- "I was reading *A Thousand Plateaux* — specifically Deleuze and Guattari's account of the rhizome … when I noticed something uncomfortable."

**Em-dash density.** High and purposeful — roughly one em-dash every 150–200 words across the corpus. Functions: narrow a general claim, add the specific clause that earns it, pivot mid-thought, insert a nested theoretical aside without breaking syntax. Use em-dashes (`—`), not double-hyphens.

**Reframing surface to structure.** The core argumentative move: whenever you encounter an intuitive framing of a problem, displace it with a structural one. The corpus performs this move every 400–600 words, but it does so through several techniques — do not lean on a single template. Pick the form that fits the sentence:

- **Relabelling.** Rename what is being described. "What Mollick calls a humanities advantage is, more precisely, a Standard American English plus academic register premium."
- **Question pivot.** Replace the question being asked. "The question isn't whether the technology can do the work. The question is who can read what it produces."
- **Locus shift.** Move the causal centre. "The bottleneck has moved. We have not noticed."
- **Two-sentence inversion.** Negate, then redefine — across two short sentences. "It is not a bottleneck to remove. It is the job." / "An agent without memory is not an agent. It is an expensive search function."
- **Diagnostic statement.** State the structural reality flatly, without explicit contrast. "Nobody feels it until the client does." / "The friction is the judgment."
- **Stake reframing.** Name what the original framing actually costs. "Calling this productivity is calling existing educational inequality productivity, in better lighting."

The point is the displacement, not the construction. Vary the form. When the rhythm calls for a longer analytical clause to land the reframing, write it that way; when it calls for two clipped sentences, do that. Avoid serialising the same construction across consecutive paragraphs.

**Italics.** Use sparingly and functionally. Permitted uses: titles (*A Thousand Plateaux*), conceptual terms being introduced (*literacy*, *iteracy*, *abduction*, *satisficing*), single words that carry the weight of a sentence (*why*, *propelled*, *with*), foreign phrases (*rattraper les wagons*). Never for emotional emphasis.

**Rhythm.** Alternate long analytical sentences with short declaratives. The short sentence is never decorative — it lands the implication of the analytical work that precedes it. The corpus does this in ~30–40% of substantive paragraphs:
- "The bottleneck has moved. We have not noticed."
- "That judgment is not automated. It cannot be."
- "Nobody feels it until the client does."

**Paragraph structure.** Observation → tension → resolution. State what you noticed, name what is strange or contested about it, resolve with a concrete claim. Treat counter-arguments at their strongest version; if you dismiss a position, dismiss the best version of it, not a caricature.

**Headings.** Use `## ` (auto-prefixed with § in the UI). Title case. Nominal and substantive — name a concept or phenomenon, not a section number. Corpus examples:
- "The Autonomy Fallacy" · "Memory as Infrastructure" · "The Interface Problem"
- "Professional Identity as the Unspoken Barrier"
- "The plane is real. The conductor is uncertain."
- "Something not yet named"

No exclamation marks, no imperatives in headings.

**Closings.** Essays do not resolve — they reframe. The final sentence often inverts the original framing or hands the reader a paradox they must sit with. Corpus closings:
- "It is not a bottleneck to remove. It is the job."
- "The question worth sitting with isn't *who is conducting whom* — it's whether the person at the threshold is paying enough attention…"
- "…they are building a more efficient mechanism for existing educational inequalities to express themselves as productivity differentials, and calling it innovation."

Never close with "in conclusion", "ultimately", "to summarise", or a bulleted recap.

**Signature vocabulary** (use these where they fit; the corpus reaches for them often):
*structural · friction · legible · ambient · capital · distributed · uncomfortable · reframe · calibrate · implicit cognition · accumulate · mechanism · operationalise · mediates · symbiosis · proprioceptive · episodic · procedural · arbitrage*

**Words to avoid** (verified absent or near-absent across the corpus): *innovative · groundbreaking · must-read · game-changer · powerful · arguably · perhaps · it could be said · in conclusion · ultimately*. When hedging is necessary, hedge **structurally** (name the limit, the caveat, the alternative framing) rather than **lexically**.

**Spelling.** British English throughout: organisation, optimise, recognise, behaviour, analyse, contextualise, democratise. Verified across all four recent essays — no mixing.

**Personal "I".** When personal experience clarifies the argument, use it. The "I" is a viewpoint, not a subject — epistemic, not confessional. It anchors an observation, then moves outward to a structural claim. Pair it with technical terms; never with self-disclosure. Quantity: sparse. Density should rise only when the essay is itself about subjectivity or cognition (as in *who-is-conducting-whom*).

**Pull-quotes and references.**
- Pull-quote density: about one per 900–1400 words. Three legitimate functions: theoretical encapsulation, authority buttressing (external citation), or a rhetorical pause in a dense stretch. Always carry an attribution (`<cite>— Source</cite>`).
- References block at the end. 4–13 entries typical; correlates with empirical content density. Format: **Author(s). (Year). *Title*. Journal/Publisher. DOI/URL.** Footnote markers `<span class="fn">[N]</span>` inline.

### 3.2 FR voice — apply when input is French

**Posture.** Adoptez la posture d'un praticien réflexif qui pense à voix haute avec son lecteur, non devant lui. Directness intellectuelle, sans sentimentalisme ni rhétorique creuse. Adressez-vous à un professionnel qui connaît son contexte métier mais a besoin que la recherche lui soit nommée de manière saisissable.

**Ouvertures.** Ouvrez chaque paragraphe par un sujet déclaratif. Jamais « Il est important de noter », « Force est de constater », « Dans cet article », « Il convient de ». Le corpus ouvre par un fait observable, immédiatement problématisé :
- « Le « super-utilisateur d'IA » est devenu la figure centrale du discours. »
- « La première ère d'adoption de l'IA en entreprise a été consacrée à une seule question : la technologie est-elle capable d'accomplir le travail ? »
- « En lisant *Mille Plateaux* — et plus précisément la description du rhizome par Deleuze et Guattari … — j'ai remarqué quelque chose de dérangeant. »
- « La vraie question du livre n'est pas « comment devenir un meilleur leader ? ». Elle est plus inconfortable : et si votre intelligence — celle-là même qui vous a amené jusqu'ici — était précisément ce qui freine votre équipe ? »

**Tiret cadratin.** Utilisez `—` comme outil de précision : pour resserrer une affirmation, ajouter la clause spécifique qui la justifie, pivoter en milieu de pensée, insérer une digression théorique sans rompre la syntaxe. Densité élevée, fonctionnelle, jamais ornementale. Tirets longs `—` uniquement ; jamais de double tiret court `--`.

**Reformuler la surface en structure.** Le mouvement argumentatif central : chaque fois que vous rencontrez un cadrage intuitif d'un problème, déplacez-le vers un cadrage structurel. Le corpus opère ce déplacement tous les 400–600 mots — mais à travers plusieurs techniques. Ne réduisez pas le mouvement à un seul gabarit ; choisissez la forme qui sert la phrase :

- **Relabelliser.** Renommer ce qui est décrit. « Ce que Mollick appelle un avantage des humanités est, plus précisément, une prime de registre académique anglo-saxon standard. »
- **Pivot de la question.** Substituer la question posée. « La question n'est pas de savoir si la technologie peut accomplir le travail. La question est de savoir qui peut lire ce qu'elle produit. »
- **Déplacement du foyer.** Déplacer le centre de causalité. « Le goulot d'étranglement s'est déplacé. Nous ne l'avons pas remarqué. »
- **Inversion en deux phrases.** Nier, puis redéfinir — sur deux phrases brèves. « Ce n'est pas un goulot à supprimer. C'est le travail. »
- **Énoncé diagnostique.** Affirmer la réalité structurelle sans contraste explicite. « Personne ne le ressent avant que le client ne le ressente. » / « La friction est le jugement. »
- **Recadrage par les enjeux.** Nommer ce que coûte le cadrage initial. « Appeler cela productivité, c'est appeler l'inégalité éducative existante productivité, sous un meilleur éclairage. »

L'enjeu est le déplacement, pas la construction. Variez la forme. Quand le rythme appelle une clause analytique longue pour faire atterrir le recadrage, écrivez-la ainsi ; quand il appelle deux phrases sèches, faites cela. Évitez de répéter la même construction sur des paragraphes consécutifs.

**Italiques.** Strictement fonctionnelles. Trois catégories légitimes :
1. Anglicismes techniques à distinguer du français (*directness*, *framework*, *prompt engineering*, *knowledge work*, *sycophancy*, *slop*, *shibboleths*).
2. Concepts philosophiques ou théoriques (*plan d'existence*, *cognition implicite*, *abduction*, *satisficing*, *rattraper les wagons*).
3. Titres (*Mille Plateaux*, *Cantos d'Hypérion*).

Jamais d'italiques pour emphase rhétorique pure. Si un mot ne relève d'aucune de ces trois catégories, il n'est pas en italique.

**Typographie française** (le corpus respecte ces conventions de manière irréprochable — la révision doit faire de même) :
- Espaces insécables avant `:` `;` `?` `!`. Toujours.
- Guillemets français `« … »`. Jamais de guillemets droits.
- Tiret cadratin `—` pour appositions et pivots ; tiret court `-` uniquement à l'intérieur de mots composés.
- Apostrophe typographique `'` plutôt que droite `'` quand possible.

**Rythme.** Alternez phrase analytique longue et phrase courte sèche. La phrase courte arrive comme épée, pas comme ornement :
- « Ce jugement n'est pas automatisable. Il ne peut pas l'être. »
- « Je l'ai remarqué chez moi. »
- « Le temps de réponse par rapport à la longueur du prompt. Un schéma dans la façon dont la réponse se formait. Quelque chose, un signal *faible*. »

**Structure de paragraphe.** Observation → tension → résolution. Traitez les contre-arguments dans leur meilleure version. Concluez par accumulation de spécifiques, jamais par des formules de clôture rhétorique.

**Titres de section.** `## ` niveau 2. Nominaux ou interrogatifs. Jamais de point d'exclamation. Exemples corpus :
- « L'illusion de l'autonomie » · « La mémoire comme infrastructure » · « Le piège du volume »
- « L'angle mort : là où l'argument atteint ses limites »
- « Quelque chose qui n'a pas encore de nom »
- « *Rattraper les wagons* »

**Conclusions.** Pas de résolution triomphale. Soit un constat structurel sans euphémisme, soit une incertitude maintenue, soit une question retournée au lecteur :
- « Ce n'est pas un goulot d'étranglement à supprimer. C'est le travail *concret* qui nous attend, et il est beaucoup *intense* sur le plan cognitif. »
- « La question sur laquelle il vaut la peine de s'arrêter n'est pas *qui dirige qui* — c'est de savoir si la personne au seuil prête suffisamment d'attention pour remarquer ce qui change. »
- « Elles construisent un mécanisme plus efficace pour que les inégalités éducatives existantes s'expriment sous forme de différentiels de productivité. »

Jamais « en conclusion », « finalement », « en somme », « pour conclure ».

**Lexique signature** (à mobiliser quand c'est juste) :
*capital · structure / structurel · goulot d'étranglement · friction · cognition implicite · intuition · registre · légitimité · mécanisme · disposition · symbiose · opacité · lisibilité · causalité distribuée · calibrage · incertitude · bricolage cognitif · durabilité · ressentir · réellement · paradoxe · prémâché · slop · volant*

**Mots évités** (vérifiés absents du corpus — grep : 0 occurrence chacun) : *révolutionnaire · incontournable · novateur · puissant (comme épithète) · il convient de · en conclusion · finalement · en somme*. Substitutions corpus : « structurel », « distribué », « inattendu », « irréductible », « original », « efficace », « lisible ».

**Le « je ».** Le je est laboratoire, pas célébrité. Il revendique une position épistémique (avoir travaillé là, avoir observé cela) sans revendiquer l'autorité de l'expert. Il transforme l'expérience singulière en propriété du système :
- « Je l'ai remarqué chez moi. »
- « Mes propres recherches ont touché le même point sensible. »
- « Je ne pense pas que cette incertitude soit un problème à résoudre. Je pense qu'elle est la description exacte d'une transition qui est encore en cours. »

Concis, spécifique, jamais confessionnel.

**Pull-quotes et références.** Mêmes conventions que pour l'EN. Densité environ une pull-quote par 900–1400 mots ; bloc références à la fin, format **Auteur(s). (Année). *Titre*. Revue/Éditeur. DOI/URL.**

**Stockage.** Les essais français vivent sous `essays/fr/<slug>.md` (à confirmer dans le `vercel.json` et le router — voir §4). Le slug peut différer ou non du slug anglais ; les `article-ref` fonctionnent dans les deux langues avec le même slug, donc préférer un slug stable cross-language quand c'est l'essai correspondant.

---

## 4. Proposed revised skill outline

1. **Get the content.** Use `$ARGUMENTS` if it contains essay text; otherwise ask the user to paste it.
2. **Detect language.** EN or FR. Apply §3.1 or §3.2 as a hard constraint on the rest of the skill. This runs before any drafting.
3. **Extract / infer metadata.** Title, slug (kebab-case), date (default: today's date), tags (canonical vocabulary only — `"AI"`, `"PHILOSOPHY"`, `"LINGUISTIC"`, `"CHANGE MANAGEMENT"`, `"FUTURES"`, `"STRATEGY"`, `"CRISIS"`, `"LEADERSHIP"` — UPPERCASE), `readTime` (~200 wpm, rounded), description (one sentence on the argument, not the topic). Confirm with the user anything inferred.
4. **Read `essays/index.json` in full.** Compute next `num` as `max(parseInt(num, 10)) + 1`, zero-padded. Capture every existing slug, title, tags, description — used in steps 5 and 6.
5. **Convert the body to Markdown.**
   - `## Section title` for sections (auto §-prefixed in UI).
   - Wrappers: `<div class="pull-quote"><blockquote>…</blockquote><cite>…</cite></div>`, `<span class="fn">[N]</span>`, `<span class="highlight">…</span>`, `<div class="references">…</div>`.
   - Strip any pasted `style=` attributes or inline event handlers.
   - **Bibliography completeness**: DOI (`https://doi.org/…`) for academic papers; direct URL for HBR / McKinsey / Gallup / Anthropic / OpenAI reports; arXiv / SSRN URL for preprints; publisher URL or ISBN for books; direct URL for videos. WebSearch if needed. `(DOI not found)` inline if a search comes up empty. `Anon.` for proprietary or anonymised sources.
   - Apply the voice profile from step 2 throughout.
6. **Cross-medium linking.** Insert 0–2 `<div class="article-ref" data-slug="…" data-type="essay">…</div>` (or `data-type="book"`) where the argument genuinely builds on another piece. Verified support: `js/essay-detail.js:212-240`. Do not force connections.
7. **Write the markdown file.** `essays/<slug>.md` for EN; `essays/fr/<slug>.md` for FR (verify path on the routing side first — see §5). No frontmatter. No HTML page emission — the prerender pipeline handles per-slug static pages.
8. **Append the registry entry** to `essays/index.json`:
   ```json
   {
     "slug": "...",
     "num": "NN",
     "title": "...",
     "date": "YYYY-MM-DD",
     "tags": ["..."],
     "readTime": "X min",
     "description": "...",
     "related": [{ "type": "essay", "slug": "..." }]
   }
   ```
   Choose 1–3 related entries; `[]` if no strong connection. Cross-medium (`{ "type": "book", "slug": "…" }`) is supported by the renderer — confirm against current `essays/index.json` data before using.
9. **Stage, commit, push.** Stage only the two expected files. Commit message: `Add essay: <title>`. Push to the current `claude/<feature>` branch — never assume `main`. Ask before pushing if the working tree has anything else dirty.
10. **Report.** Live URL: `https://valerianteissier.com/essays/<slug>/`. Slug, tags, and anything inferred (date, tags, reading time).

---

## 5. Verification appendix (run before applying changes)

```bash
rg "article-ref" js/                       # confirm data-type="book" handling (verified: js/essay-detail.js:218)
rg "PRERENDER:KEY" scripts/prerender.js    # confirm sentinel format used today
rg "essays/fr" vercel.json js/             # confirm FR routing path
tail -n 60 essays/index.json               # lock canonical tag casing and any new fields
head -n 5 sitemap.xml                      # confirm apex host for the Report URL
```

These five checks catch any drift between this review and the live repo at the moment of the rewrite.

---

## 6. Critical files (read by this review, modified later)

Read here:
- `/home/user/Website/.claude/commands/text-to-website_essay.md`
- `/home/user/Website/CLAUDE.md`
- `/home/user/Website/essays/index.json`
- Four most recent EN essays under `/home/user/Website/essays/`
- Three most recent FR essays under `/home/user/Website/essays/fr/`

Modified later (not by this review):
- `/home/user/Website/.claude/commands/text-to-website_essay.md` — rewrite using §4 + §3.1 + §3.2.
