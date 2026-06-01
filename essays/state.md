# Pending cross-references — to rewire when target essays are published

These three essays were published from drafts that referenced **not-yet-published**
essays. Per the publication decision, those forward references were phrased in the
**future tense, with no clickable link**. When the target essays go live, convert
each future-tense mention into a clickable cross-reference using:

```html
<div class="article-ref" data-slug="<target-slug>" data-type="essay">…</div>
```

## Already wired (target is published)

- `briefing-is-not-chatting` → **The Articulation Gap**
  (`linguistic-capital-ai-inequality`) — clickable `article-ref` in the intro.
  Live. No action needed.

## To rewire once the target is published

### `briefing-is-not-chatting.md` (EN) and `fr/briefing-is-not-chatting.md` (FR)
- **Conclusion paragraph**, currently: *"This fault line is orthogonal to
  another, which I will examine in a forthcoming essay: where organisational
  trust depletes collectively across failed deployments…"* (FR: *"…que
  j'examinerai dans un prochain essai…"*).
  - **Target**: the planned essay on collective trust depletion across failed
    deployments (draft working title *"L'ardoise n'est jamais vierge" /
    the slate is never blank*). NB: the published essay **The people in the
    middle of GenAI adoption** (`genai-adoption-people-in-the-middle`) already
    covers "each failed rollout consumes trust that won't replenish itself" — if
    that is the intended target, point the link there instead of waiting.
  - **Action**: replace the future-tense clause with an `article-ref` once the
    target slug is confirmed.

### `the-ghost-competence.md` (EN) and `fr/the-ghost-competence.md` (FR)
- Discusses Beane's *shadow learning* and explicitly contrasts the "active,
  intentional minority" against the "passive majority." The companion draft
  **Tactics in the age of agentic capture** (unpublished) treats shadow learning
  as a Certeau-style tactic.
  - **Action**: when *Tactics* is published, add an `article-ref` near the
    Beane / shadow-learning passage to mark the distinct angle, and verify the
    wording stays distinct from the *Tactics* framing.
- Conceptually adjacent (no bibliographic overlap, no link required):
  `the-human-bottleneck` — the bottleneck migrates to human judgment; this essay
  explains why that judgment can't form under an agent-first regime.

### `all-the-unwritten-processes.md` (EN) and `fr/all-the-unwritten-processes.md` (FR)
- Shares a core source (**Lebovitz et al. 2022**) with the unpublished draft
  **Verification burden** — distinct angles: here = structural floor of
  *upstream* codification; there = cognitive cost of verification *in use*.
  - **Action**: when *Verification burden* is published, add an `article-ref`
    near the Lebovitz passage with an angle-separation sentence.
- Shares a core source (**Kellogg, Valentine & Christin 2020**) with the
  unpublished draft **Déresponsabilisation / AI surveillance** — distinct angles:
  here = articulation work only; there = the 6 Rs of algorithmic control.
  - **Action**: when that essay is published, add an `article-ref` near the
    Kellogg / articulation-work passage.

---
*This file is a working note for the author. It is not linked from the site and
is ignored by the prerender pipeline (which only reads `index.json` + the
matching `<slug>.md`).*
