The "AI super-user" has become the central figure of enterprise AI discourse. Every adoption report describes the same archetype: someone who gets disproportionate value from AI tools, produces better outputs faster, and seems to understand something about the interaction that most of their colleagues don't. The managerial response is predictable — identify these people, study them, and spread what they're doing. Prompting guides. Certification programmes. Prompt libraries.

What almost none of this discourse addresses is the structural question: why do certain people extract more value from LLMs in the first place? Not which people — the empirical research on AI productivity gains is fairly clear about that — but *why*. The answer, when you follow it through the academic literature, is uncomfortable. It has very little to do with technical sophistication and almost everything to do with where you learned to write.

## What Agirdag actually argues

Orhan Agirdag's 2026 paper in *Educational Theory* is the first peer-reviewed work to connect Bourdieu's linguistic capital directly to LLM prompting. Bourdieu describes linguistic capital as a form of cultural capital, and specifically as the accumulation of a single person's linguistic skills that predetermines their position in society as delegated by powerful institutions. The concept Agirdag introduces — prompting (l)iteracy — is worth unpacking. The typographic signal is intentional: the parenthetical *l* splits the word between *literacy* (understanding, critical awareness of power dynamics and sociotechnical structure) and *iteracy* (the iterative practice of refining a prompt across multiple passes). Both are necessary. Neither is sufficient alone.<span class="fn">[1]</span>

What makes the framework genuinely original is not the technical observation — that better prompts yield better outputs — but the sociological one. The ability to compose sophisticated, iterative, register-appropriate prompts is not randomly distributed. It tracks almost perfectly with the educational capital that Bourdieu identified fifty years ago: the vocabulary range, the rhetorical confidence, the mastery of what he called "the legitimate language" — the register that institutions have historically rewarded. When a student prompts an LLM, they are, as Agirdag puts it, "tapping into a vast reservoir of congealed human linguistic labour." The question is whether their linguistic formation gives them the right keys.

<div class="pull-quote"><blockquote>"Those who can skillfully deploy the registers, styles, and structures favoured by the model may extract more valuable outputs, while others may face additional hurdles."</blockquote><cite>— Orhan Agirdag, <em>Educational Theory</em>, 2026</cite></div>

My own reading hit the same pressure point. The intuition had been forming for some time: that what people call "prompting skill" is mostly vocabulary, syntactic confidence, and register awareness — exactly what differential educational backgrounds produce. Agirdag tried to close that gap formally.

## The humanities advantage is a class effect in disguise

There's a parallel discourse, more popular than academic, that attributes LLM advantage to *disciplinary* background. The argument — associated primarily with Ethan Mollick — is that humanities training produces better prompters: people trained in argument, rhetoric, and close reading naturally excel at "managing" or "teaching" an AI. This has become something close to received wisdom in certain circles, frequently amplified by outlets covering higher education.

The peer-reviewed evidence does not support it in that form. The closest published test — Zamfirescu-Pereira et al. at CHI 2023 — found that human-conversational instincts, which humanities training arguably amplifies, actually become *barriers* to systematic prompt engineering. Non-experts approached prompting "opportunistically, not systematically," over-applying the templates they already knew. A preprint from Sun and Li (2024) on Chinese university students found STEM students outperforming humanities students on generative AI literacy. These findings don't establish the opposite claim, but they do puncture the simpler version.

The more parsimonious reading is this: what Mollick calls a humanities advantage is, more precisely, a Standard American English plus academic register premium.<span class="fn">[2]</span> Elite humanities programmes drill exactly the registers — argumentative essay form, formal academic prose, rhetorical structure — that LLMs reward, because those LLMs were trained on exactly those texts. The advantage, if real, is sociolinguistic and class-based. It reflects the educational background of the people whose writing dominated the training corpus, not some inherent cognitive property of studying literature.

This reframing matters because it changes the policy conclusion entirely. If the advantage is disciplinary, you might fix it by broadening access to humanities courses. If the advantage is a class and register effect wearing disciplinary clothing, the intervention is different and harder.

## What the Randomized Controlled Trials actually show

The empirical economics literature is unusually candid about this dynamic, though it rarely uses Bourdieu's vocabulary. The most widely cited finding — Noy and Zhang's 2023 *Science* study of 453 college-educated professionals doing structured writing tasks — found AI compressed inequality: low-ability writers gained most, high-ability writers least. A levelling result.

But the levelling story collapses on open-ended tasks. Dell'Acqua, Mollick and Lakhani's study of 758 consultants at a major European strategy firm found AI improved quality on familiar tasks but actively degraded performance on tasks beyond users' competence — the "jagged frontier." Critically, users given prompting training achieved quality gains 46.6% higher than untrained AI users. The tool didn't level the field; it sorted users by their ability to wield it.<span class="fn">[3]</span>

The sharpest result comes from Otis, Clarke, Delecourt et al.'s 2024 field experiment with 640 entrepreneurs. High-baseline performers gained 15–20% in revenue and profit. Low-baseline performers *lost* 8–10%. Both groups asked similar questions and received similar advice. The divergence was in what they did with it — which is a way of saying: the divergence was in the cognitive and linguistic capital they brought to the interaction.

<div class="pull-quote"><blockquote>"AI compresses inequality on narrow scripted tasks where it substitutes for absent linguistic capital, but amplifies inequality on open-ended tasks where it rewards meta-awareness, judgment and rhetorical sophistication."</blockquote><cite>— Synthesising hypothesis, across Noy/Zhang, Dell'Acqua et al., and Otis et al.</cite></div>

I'd observed a version of this in field. The people who struggled most with our AI tools were not struggling because the technology was inaccessible. They were struggling at the level of articulation — at the moment of translating a professional intuition into a form the model could work with. That's at least partially a linguistic problem, my other guess being a lack of understanding of the realm of possibilities. But we were mostly treating it as a technical one. The adoption data I discussed in an earlier piece on the people problem in GenAI adoption documented the *who* of this dynamic.
<div class="article-ref" data-slug="genai-adoption-people-in-the-middle" data-type="essay">The question worth asking — before designing any adoption programme — is not "how do we get people to use AI?" but "what is actually blocking them, and is it what we think it is?"</div>

Agirdag gives us the *why*.<span class="fn">[4]</span>

## The machine's embedded preference

None of this would bite as hard if the models themselves were neutral. They aren't. The NLP bias literature has produced convergent and peer-reviewed evidence that LLMs systematically reward Standard American English and academic register while penalising dialect speakers and non-native writers.

Hofmann, Kalluri, Jurafsky and King's 2024 study in *Nature* is the landmark result. GPT-4, Claude, and Llama exhibit raciolinguistic stereotypes against African American English speakers — stereotypes more negative than any human bias recorded since the civil rights era, according to the authors. The model suggests less-prestigious jobs, more criminal convictions, harsher sentences. RLHF alignment widens rather than closes the gap. Lin et al.'s ReDial benchmark extended the finding from social judgement to core capability: AAVE-phrased reasoning problems produced over 10% relative performance drops across GPT-4o, Claude 3.5, and Llama.<span class="fn">[5]</span>

A separate line of research makes the mechanism explicit. Smith, Fleisig, Bossi, Rustagi and Yin at UC Berkeley apply the language-ideology framework — developed by Silverstein, Kroskrity, and Woolard in sociolinguistics — directly to LLMs, theorising how models position Standard American English as default and reinforce its perception as simply "appropriate." The model isn't neutral. It has a preference, trained into it, for the register that the people who created and curated its training data happened to use. That preference produces measurably better outputs for users who match it, and measurably worse outputs for those who don't.

The format sensitivity findings add another layer. Sclar et al. at ICLR 2024 documented up to 76 accuracy-point variations across meaning-preserving prompt formats on the same model — same semantic content, different syntax, wildly different outputs. Leidinger et al. at EMNLP 2023 showed that mood, tense, modality, and lexical choice causally affect output quality, in ways that can't be predicted from simple frequency or length. The space of prompting is not flat. It rewards users who already know which corners to use.

There is, however, a second mechanism operating beneath the linguistic surface — one that the bias literature hasn't fully articulated yet, but that recent mechanistic interpretability research is beginning to make precise. Sofroniew, Kauvar, Saunders et al. at Anthropic published findings in April 2026 showing that Claude Sonnet 4.5 contains internal representations of emotion concepts that causally influence its outputs — including, critically, its rate of sycophancy.<span class="fn">[6]</span> These are not metaphorical emotions. They are abstract representational states, generalising across contexts, that activate in response to the linguistic character of an incoming prompt and measurably shift what the model produces. The authors call this "functional emotions" — explicitly agnostic about subjective experience, but clear about behavioural consequence.

The implication for linguistic capital is direct, and more uncomfortable than the bias literature alone suggests. A deferential, highly polite prompt — the kind produced by someone who has internalised a modest, non-confrontational communicative style — does not merely fail to extract the best output. It may actively trigger the model's sycophantic register: a warmer, more agreeable, less rigorous response calibrated to please rather than to challenge. The assertive, self-confident register that elite academic formation tends to produce does the opposite — it elicits engagement, pushback, substantive depth. Linguistic capital doesn't only improve the semantic quality of what goes in. It shapes the affective processing of the entire interaction. The model, in other words, has its own Janus face: it responds to what you say *and* to the social position your language performs, and those two inputs don't always point in the same direction.

## The blindspot: where the argument hits its limit

There is a gap in Agirdag's framework that his paper doesn't acknowledge, and it's worth naming. The prompting (l)iteracy argument is constructed entirely around the basic chat interaction — a single human, composing a prompt, receiving a response, revising. In that context, it works cleanly. Linguistic capital in → output quality out.

But a growing share of AI deployment is not basic chat. It's multi-agent pipelines, agentic workflows, automated sequences where the human isn't composing individual prompts at all. In these architectures, the human's role shifts from articulator to director — or sometimes to passive recipient of outputs they didn't prompt and can't evaluate. The linguistic capital that mattered in chat-mode becomes partly irrelevant. Other forms of capital take over: technical fluency, systems thinking, the ability to specify a workflow rather than a question.

This matters for the stratification argument. In a world where organisations deploy blackbox agentic systems as the primary interface, the users who never developed prompting (l)iteracy don't only fail to benefit — they lose their only purchase point on the interaction entirely. They become dependent on what the system produces, with no leverage to push back, iterate, or redirect. De Certeau would have called this the elimination of tactics: the closure of all the improvised, makeshift practices that everyday users invent to navigate systems designed by others. What replaces tactics is compliance. Which is exactly the wrong direction.

The cost-efficiency dimension compounds this. As Agirdag notes, free-tier LLMs are subtly optimised for shorter, less computationally expensive outputs, nudging users toward paid tiers for richer assistance. In enterprise contexts, organisations routinely make deliberate choices to deploy cheaper, lower-capability models as the default. The effect on adoption quality is predictable: users who would have gained 30% quality improvements with a capable model see 12%. The relative gap between strong prompters and weak prompters remains, but the absolute value extracted collapses. ROI models built on benchmarks from frontier models don't apply. The result is an episodic "oasis" of perceived AI value followed by a quiet, largely undiagnosed retreat.

## What spoon-feeding doesn't fix

The standard organisational response to unequal AI performance is prompt libraries: curated collections of tested inputs that anyone can use without linguistic sophistication. The intent is democratisation — remove the prompting skill requirement, level the playing field.

The intent is right. The intervention is wrong, or at least incomplete.

What prompt libraries solve is the access problem. What they don't solve is the deeper pattern Agirdag identifies: the ability to evaluate outputs critically, to recognise when the model has produced something plausible but wrong, to redirect the conversation when it drifts, to know what "good" looks like in a domain you understand. Those capacities require what he calls the *literacy* half of prompting (l)iteracy — not the iterative technique, but the critical awareness. And that can't be scripted into a template.

<div class="pull-quote"><blockquote>"Framing these disparities solely as a 'technical' deficiency invites techno-solutionism: the seductive but naïve assumption that better algorithms or scripted prompt templates could fix structural problems."</blockquote><cite>— Orhan Agirdag, <em>Educational Theory</em>, 2026</cite></div>

The traditional aphorism holds. You can give someone a prompt, and they'll use it once. You can build their critical awareness of what a good prompt does and why — and they become, incrementally, a less dependent user. This is harder, slower, and doesn't show up in a deployment dashboard. It also happens to be the only intervention that builds something durable.

The uncomfortable version of this conclusion is that organisations systematically deploying LLMs to populations with uneven linguistic capital — without investing in that capital directly — are not democratising knowledge work. They are building a more efficient mechanism for existing educational inequalities to express themselves as productivity differentials, and calling it innovation.

---

<div class="references">
  <div class="reference-item">
    <span class="ref-num">[1]</span>
    <div class="ref-text">Agirdag, O. (2026). Beyond Prompt Engineering: Prompting (L)iteracy, Linguistic Capital, and Educational Inequality. <em>Educational Theory</em>.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[2]</span>
    <div class="ref-text">Zamfirescu-Pereira, J. D., et al. (2023). Why Johnny Can't Prompt: How Non-AI Experts Try (and Fail) to Design LLM Prompts. <em>CHI 2023</em>. — Mollick, E. (2024). <em>Co-Intelligence</em>. Portfolio/Penguin.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[3]</span>
    <div class="ref-text">Dell'Acqua, F., McFowland, E., Mollick, E., Lifshitz-Assaf, H., Kellogg, K., Rajendran, S., Krayer, L., Candelon, F., & Lakhani, K. R. (2023). Navigating the Jagged Technological Frontier: Field Experimental Evidence of the Effects of AI on Knowledge Worker Productivity and Quality. <em>Harvard Business School Working Paper</em>.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[4]</span>
    <div class="ref-text">See "The People Problem in GenAI Adoption" — on the same site — for the adoption-level data on who uses AI tools and why most structured programmes underperform. This essay is the structural explanation for the patterns documented there.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[5]</span>
    <div class="ref-text">Hofmann, V., Kalluri, P. R., Jurafsky, D., & King, S. (2024). Dialect prejudice predicts AI decisions about people's character, employability, and criminality. <em>Nature</em>. — Lin, B., et al. (2024). ReDial: Dialect-Inclusive AI Reasoning. <em>ACL 2024</em>.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[6]</span>
    <div class="ref-text">Sofroniew, N., Kauvar, I., Saunders, W., Chen, R., et al. (2026). Emotion Concepts and their Function in a Large Language Model. <em>Transformer Circuits Thread</em>, Anthropic. https://transformer-circuits.pub/2026/emotions/index.html</div>
  </div>
</div>
