I was reading *A Thousand Plateaux* — specifically Deleuze and Guattari's account of the rhizome, a structure with no root, no hierarchy, multiple entry points, no privileged direction — when I noticed something uncomfortable. The description fit what I had been doing at work.

Working with large language models and agentic systems had been, for some months, doing something strange to how I moved through ideas. I was being *propelled* — through deep searches, through cascades of prompts, through emergent answers — into fields and sub-fields I had no existing path through. In the classic sense, I didn't *know* these territories. But I was functioning in them. The model wasn't just retrieving information; it was generating enough structure for me to place my intuitions and let them move. I didn't need the full path. I just needed the language to express my curiosity evenly, and the paths opened.

Deleuze and Guattari called this a *plan d'existence* — a plane of immanence, a horizontal field where thinking happens without the vertical scaffolding of hierarchy and prior mastery. That is close to what it felt like. I wasn't climbing a tree of knowledge; I was spreading across a surface. Which raised a question I couldn't shake: was I thinking differently — or was something else thinking, and I was providing the intuition as raw material?

## The plane is real. The conductor is uncertain.

What changed practically was this: I could take a structurally sound intuition from a domain I understand and transpose it, through the model, into the language of domains where I have no formal standing. Strategy, marketing, sales adoption — fields with their own registers and shibboleths — became traversable. Ideas multiplied. The friction of translation dropped.

This is seductive. It feels like a cognitive upgrade: the "super-user" of popular managerial discourse, orchestrating tools, steering agents, converting expertise into leverage. And for a while, that framing satisfied me.

But then I hit a passage in Hayles that stopped it:

<div class="pull-quote"><blockquote>"As LLMs penetrate social, economic, political, and financial systems at speed, they are creating a 'world model' that will shift the underlying political logics of Western cultures."</blockquote><cite>— N. Katherine Hayles, "Modes of Cognition: Implications for Large Language Models"</cite></div>

The conductor metaphor assumes the baton is yours. The question Hayles opens — and that I couldn't close — is whether the score was written elsewhere.

## *Rattraper les wagons* 

There is a specific failure mode I kept running into, and Parisi named the mechanism before I could.

In her work on what she calls the "automation of automation," Parisi describes a problem in how machine reasoning now operates: it no longer moves through deduction and induction alone, but through something closer to Peirce's *abduction* — hypothesis-formation from discursive and non-discursive signals simultaneously, at a level of abstraction the human interlocutor cannot follow in real time.<span class="fn">[1]</span> The system produces intelligence. The human receives an answer. The middle is a black box.

I called this *rattraper les wagons* — catching the train after it's already gone. I'd go through a substantial thinking process, arrive somewhere genuinely useful, and then realise I had no clean way to reconstruct the route. Not because I hadn't thought; but because the thinking had been distributed across me, the model, and a series of prompt iterations that no longer existed in recoverable form. The conclusion was real. The reasoning chain wasn't mine to show.

This is, in practice, a problem every time you need to transfer the insight — to a colleague, a client, a team. You can't hand someone a destination without a map. And the map got generated in a form neither you nor they can read.

What Parisi's framework makes visible is that this isn't a user error. It's a structural feature of how abductive machine reasoning operates. The internal limits of the algorithm are precisely what generate emergent outputs. But the cost of that emergence falls on the human side: you are "thrown" at an answer with no capacity to conduct the reasoning itself.

## The intuitive muscle

Here is where Hayles offers something more useful than Parisi's critique.

She draws a clean distinction between conscious reasoning and *implicit cognition* — the cognitive mode that runs beneath awareness, handling motor-sensory processes, pattern recognition, things learned so thoroughly they become automatic. Once you've learned to drive, you don't think about driving; you think about the meeting, and the car handles itself.

<div class="pull-quote"><blockquote>"Nonconscious cognition is the cognitive capacity at work when people avoid stepping on snakes, as they react much faster than consciousness could manage."</blockquote><cite>— N. Katherine Hayles, "Modes of Cognition: Implications for Large Language Models"</cite></div>

The implication she doesn't quite draw, but which I think is there: working extensively with AI systems develops a form of implicit cognition *about* those systems. I noticed it in myself. I would stop a model mid-task — not because I had analysed what it was doing, but because something felt wrong about the direction. The response time relative to the prompt length. A pattern in how the output was forming. Something.

Apparently this isn't idiosyncratic. The more experienced the user, the more they interrupt models. The interruptions come faster than analysis could explain. That's implicit cognition operating — a felt sense of system behaviour that accumulates over time, below the threshold of conscious articulation.

This matters more than it might seem. Because it means the human-AI relationship, at sophisticated levels of use, is not just a reasoning collaboration. It develops a proprioceptive layer: an attunement, an embodied familiarity that shapes when to trust, when to push back, when to let the model run.

## The problem with the blackbox

Which brings me to adoption — and why the current dominant model of embedding AI in workflows carries a serious structural flaw.

If the system is a blackbox, the intuitive muscle cannot develop.

You build implicit cognition about a system by interacting with its internals — not its outputs alone. If all you ever see is results, you cannot calibrate the felt sense that tells you when the results are unreliable. You remain at the level of conscious evaluation, which is slower, less accurate, and more easily fooled by well-presented wrong answers.

Grumbach puts it cleanly when he writes that decision-making in distributed systems is not strict optimisation but *satisficing* — seeking solutions that are good enough given contextual constraints, through the coordination of internal heuristics and external affordances.<span class="fn">[2]</span> The heuristics are the human side of that equation. But heuristics only develop through exposure to what they're calibrating against. Blackbox systems actively prevent that development.

The practical consequence: organisations embedding agentic AI in processes, without building conditions for users to develop genuine familiarity with how those systems fail, are producing a workforce that can use the tool and cannot evaluate it. That's not augmentation. It's a new form of dependence.

There is a Girardian dimension to this that organisations are not yet reckoning with. Girard's account of the scapegoat mechanism describes how communities under pressure — after a crisis whose causes are genuinely distributed and opaque — converge on a single sacrificial figure to restore social coherence.<span class="fn">[3]</span> The logic is not rational; it's structural. Someone must be legibly responsible, or the community cannot move on. When an AI-assisted decision fails — a flawed recommendation, a misread signal, an automated action nobody fully authorised — the causal chain runs through the model's training, the prompt design, the integration architecture, the deployment decision, and the person who clicked approve. None of those nodes is the cause in isolation. All of them are partially responsible. But the organisation, under pressure, will locate accountability somewhere singular and human. It will almost always land on the most visible recent human actor: the user. Not the system architect. Not the vendor. The person whose name is on the output.

This isn't a bug in how organisations work. It's how they have always worked. The problem is that AI systems, by distributing causality so thoroughly, make scapegoating simultaneously more inevitable and more unjust. The gap between where blame actually falls and where it ought to fall will widen as systems grow more autonomous — and nobody is designing governance with that gap in mind.

The more interesting design question is: what would a system look like that actively cultivated the user's intuitive muscles rather than substituting for them — and that made accountability legible at the right level of the chain, rather than defaulting to whoever touched it last?

## Symbiosis from below

Grumbach again offers a frame worth keeping, drawn from a conclusion I'd arrived at independently: AI systems embedded in processes must be built *with* the daily practitioners who will use them — not handed down from process architects or senior administrators who set goals from above and consider their work done.<span class="fn">[3]</span>

The reason is specific. Daily practitioners, in virtually every organisation, have most likely already drifted from formal process specifications. They've bent procedures to fit their own cognitive rhythms, their own shortcuts, their own sense of what actually produces good outcomes. The formal rules describe a territory nobody quite lives in. The actual territory is maintained by implicit agreements and workarounds that the practitioners know and the architects don't.

When you impose an AI system on top of formal rules that the workforce has already quietly abandoned, you get a system that enforces a process nobody uses. The result is either quiet non-adoption or the development of workarounds to the workarounds.

Real symbiosis — Grumbach's term, and it's the right one — would mean building AI into the actual cognitive habits of the people whose work it mediates. That requires starting with observation rather than specification. It requires treating the practitioner's drift from formal rules not as a compliance failure but as information about how the work actually functions.

Modern management thinking tends to set the goal and let people find their own path. What it doesn't account for is that embedding an AI system into a process is not neutral to those paths. It forecloses some, amplifies others, and generates new ones that nobody planned for.

## The people who miss the train

One thing the literature doesn't adequately address is the asymmetry in arrival.

There is now a generation of practitioners who developed their relationship to AI gradually, through the language-model phase: learning to prompt, developing intuitions about model behaviour, building implicit cognition through direct exposure. For them, the move toward agentic systems — where the AI takes sequences of actions rather than answering questions — is an extension of an existing relationship.

Then there are the people who arrive at agentic systems without that foundation. They missed the slower-paced phase of model interaction. They're handed an autonomous system and told to trust it. And they have none of the proprioceptive grounding that would tell them when not to.

This is not a training problem in the conventional sense. No documentation tells you what a model's responses feel like when it's about to fail. That knowledge is accumulated through friction, through things going wrong in ways you can notice in real time, through the development of a relationship in the etymological sense: a carrying-back, a standing-in-relation-to.

If organisations skip that accumulation — if they adopt agentic systems at scale before their workforces have developed any felt sense of what AI systems do when they're uncertain — then the efficiency gains at the surface will be accompanied by systematic miscalibration underneath. Not because the technology failed. Because the symbiosis was never built.

Hayles is right that human and artificial intelligence will evolve together. The question is whether the evolution is designed for, or whether it simply happens — and we retrospectively call whatever results "adoption."

## Something not yet named

I keep returning to a figure from Dan Simmons' *Hyperion Cantos*: John Keats, the cybrid — a human/android construct carrying an uploaded consciousness, built to exist at the threshold between two incompatible orders of being. He is not a degraded human. He is not a sophisticated machine. He is something genuinely new, and the novel never fully resolves what that means. He doesn't resolve it either. He inhabits it.

What struck me, reading Hayles on the infosphere — on cognition circulating through hybrid systems of code, matter and mind — was that the cybrid is a better figure for the current moment than the conductor. The conductor stands outside the orchestra, shaping it through intention and mastery. The cybrid is inside the system, constituted by it, unable to fully separate what is his from what was given to him. His humanity is real. It's also constructed. Both things are true simultaneously and the tension between them doesn't dissolve.

That is closer to what working with AI systems at depth actually feels like. Not the clean sovereignty of a super-user steering tools. Something more ambiguous: a genuine change in the plane of cognition, real capacities that weren't there before, and a persistent uncertainty about which part of the thinking is yours. Not human in the old sense. Not robotic. Both, in a form that doesn't have a settled name yet.

The academic literature — Parisi, Hayles, Clark, Grumbach — circles around this position. Parisi proposes an "alien subject" emerging from recursive computation, neither enslaved component nor sovereign orchestrator, but develops it as a theoretical category rather than a lived condition. The cybrid makes it concrete: this is what it feels like from the inside, to be something new while carrying forward everything that made you human, uncertain about where one ends and the other begins.

I don't think that uncertainty is a problem to be solved. I think it's the accurate description of a transition that is still happening. The question worth sitting with isn't *who is conducting whom* — it's whether the person at the threshold is paying enough attention to notice what's changing, and building the conditions for that change to go somewhere worth going.

<div class="references">
  <div class="reference-item">
    <span class="ref-num">[1]</span>
    <div class="ref-text">Parisi, L. (2019). The alien subject of AI. <em>Subjectivity</em>, 12(1), 27–48. <a href="https://doi.org/10.1057/s41286-018-00064-3" target="_blank" rel="noopener">doi:10.1057/s41286-018-00064-3</a></div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[2]</span>
    <div class="ref-text">Grumbach, S. (2026). Cognitive assemblages: Living with algorithms. <em>Big Data and Cognitive Computing</em>, 10(2), 63. <a href="https://doi.org/10.3390/bdcc10020063" target="_blank" rel="noopener">doi:10.3390/bdcc10020063</a></div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[3]</span>
    <div class="ref-text">Girard, R. (1978). <em>Des choses cachées depuis la fondation du monde</em>. Grasset. English translation: <em>Things Hidden Since the Foundation of the World</em>. Stanford University Press, 1987.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[4]</span>
    <div class="ref-text">Hayles, N. K. (2017). <em>Unthought: The power of the cognitive nonconscious</em>. University of Chicago Press. <a href="https://ageingcompanions.constantvzw.org/books/Unthought_N._Katherine_Hayles.pdf" target="_blank" rel="noopener">PDF</a> — Hayles, N. K. (2025). Modes of cognition: Implications for large language models. <em>Antikythera Journal</em>. <a href="https://modesofcognition.antikythera.org/" target="_blank" rel="noopener">antikythera.org</a></div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[5]</span>
    <div class="ref-text">Clark, A. (2025). Extending minds with generative AI. <em>Nature Communications</em>, 16, 4627. <a href="https://doi.org/10.1038/s41467-025-59906-9" target="_blank" rel="noopener">doi:10.1038/s41467-025-59906-9</a></div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[6]</span>
    <div class="ref-text">Simmons, D. (1989). <em>Hyperion</em>. Doubleday.</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[7]</span>
    <div class="ref-text">Deleuze, G., & Guattari, F. (1980). <em>Mille plateaux</em>. Éditions de Minuit.</div>
  </div>
</div>
