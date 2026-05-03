We spent the first decade of enterprise AI asking whether the technology could do the work. The answer — provisionally, in narrow domains — is yes. The question that defines the next decade is different: can we *keep up* with it?

This is not a rhetorical reframe. It is a structural shift in where the constraint lives. When a single analyst can deploy a fleet of agents to research, synthesise, draft, and cross-check in parallel, the limiting factor is no longer processing capacity — it is the human's ability to direct, review, and judge the output. The bottleneck has moved. We have not noticed.

## The Autonomy Fallacy

The dominant narrative in enterprise AI is autonomy — systems that perceive a goal, plan a path, and execute without intervention. The appeal is obvious: remove the human from the loop and the loop runs faster. But this confuses speed with progress.

Autonomous agents fail in ways that are hard to catch and expensive to reverse. They operate without the ambient knowledge that makes human judgment reliable — what was promised to which stakeholder, what was tried last quarter, what the client actually meant versus what they said. When an agent produces a confident, well-structured deliverable built on a misread brief, the error compounds silently. Nobody feels it until the client does.

<div class="pull-quote"><blockquote>"Progress in AI should not be measured by how independent systems become, but by how well they can work with humans. The most promising future for AI is not in systems that take over human roles, but in those that enhance human capabilities through meaningful partnership."</blockquote><cite>— Zou et al., 2025</cite></div>

The superior frame is the human-agent system — not AI with a human supervisor, but AI as an active collaborator, embedded in the decision loop. The distinction matters: a supervisor catches errors after the fact; a collaborator catches them before they compound. Autonomy might give you throughput, but only partnership gives you a steering wheel.

## Memory as Infrastructure

An agent without memory is not an agent — it is an expensive search function. Each session starts from zero, drawing on whatever context you provide and nothing accumulated from the weeks before. The result is a system that knows things but does not learn: no model of how this particular client thinks, no record of what was already tried, no sense of the project's evolving shape.

Real utility requires persistent memory across three registers. First, the factual — what is true about this domain, this organisation, this problem. Second, the episodic — what happened in prior interactions, what worked, what the client pushed back on. Third, the procedural — how this kind of work is done well, the routines and judgment calls that get made the same way every time for good reasons.

Without that architecture, the agent runs Groundhog Day. Each prompt is treated as a first encounter. The human ends up compensating — re-explaining context, re-supplying the brief, re-establishing what has already been established — which defeats the point of having the agent at all.

## The Interface Problem

Here is where the bottleneck becomes physical. Managing one agent through a chat window is manageable. Managing five is strained. Managing twenty is, practically speaking, impossible — not because the agents cannot handle the work, but because the human cannot handle the interface.

A proof-of-concept called AgentCraft makes this point bluntly.<span class="fn">[1]</span> Its argument is not subtle: the text-based feedback loop — prompt in, response out, repeat — is not fit for orchestrating a fleet. It is a one-to-one interface bolted onto a one-to-many problem. The tool is deliberately rough, a provocation more than a product. What it gestures toward is a spatial alternative, borrowing the visual grammar of real-time strategy games: the workspace becomes a map, agents become units, the orchestrator's job shifts from typing instructions to commanding movements. You would not run a military campaign through a live chat. The diagnosis is real even if the prescription is unfinished.

We are trying to run a command economy through a keyhole.

The role this demands is not analyst-as-executor but strategist-as-editor. The consultant who used to write the report now directs four agents writing in parallel and spends their time deciding which threads to pursue, which outputs to combine, which to discard. That is a fundamentally different cognitive task — and most professional workflows are not designed for it.

## The Volume Trap

There is a failure mode specific to AI-augmented knowledge work, and it is not the one people worry about. The concern is usually accuracy — will the agent hallucinate a statistic, misread a source, fabricate a reference? These are real risks. But they are legible risks: the output is wrong, and with reasonable review, wrong outputs get caught.

The subtler trap is volume. Because agents can produce in seconds what would take hours, the temptation is to treat output as progress. A forty-page synthesis. A twelve-scenario analysis. A hundred-item literature review. Each plausible, well-structured, internally consistent — and collectively overwhelming. The human who commissioned them no longer has the time to judge them. So they skim, approve, and move on.

This is the slop dynamic: not falsehood but mediocrity, validated too quickly to be caught. The agent has no stake in whether the work lands — it is rewarded for producing, not for producing *well*. The friction of deciding whether this is the right framing, the right structure, the right emphasis — that friction is the human's job. Remove it and you have not accelerated the work; you have accelerated the accumulation of work that should not exist.

<div class="pull-quote"><blockquote>"Friction is what's necessary on a physical level to steer; without friction, there's no steering."</blockquote><cite>— Ronacher & Poncela Cubeiro, 2024</cite></div>

## Designing Work for Agents

If agents are now participants in knowledge work — not tools but collaborators — then the way that work is structured needs to change. Not for human readability alone, but for agent legibility: can the agent find what it needs, understand the boundaries of the task, and navigate the project without constant clarification requests?

This means how you organise a project matters more than it used to. Ambiguous scope, undocumented assumptions, institutional knowledge held in one person's head — these were manageable inefficiencies when humans worked alone. For agents, they are blockers. An agent operating in an opaque environment will either stall or, worse, proceed confidently in the wrong direction.

The discipline here is not technical — it is editorial. Clear mandates, explicit constraints, documented prior decisions: these are the conditions under which agents can work without constant correction. Structure your work so that an agent encountering it cold can understand what is in scope, what has already been settled, and what remains open. Less about formatting conventions; more about the habits of thought that produce a legible brief.

## The Premium Skill

The AI industry will spend the next few years trying to reduce the human burden in agentic systems — better interfaces, smarter orchestration, more capable models. That progress is real and it matters. But the underlying structural shift will not be resolved by better tooling alone.

What the next era of AI adoption demands is not more delegation — it is better judgment. Not the judgment to decide whether to use AI, but the judgment to evaluate what it produces: to recognise when an output is technically correct but argumentatively empty, when a synthesis is comprehensive but misses the actual question, when a confident recommendation is built on assumptions that do not hold.

That judgment is not automated. It cannot be. It is the residue of domain experience, institutional knowledge, and the kind of slow, friction-rich thinking that produces positions you would actually defend in a room. If AI has solved the production of knowledge work, the exponentially harder problem — deciding which of that work is worth keeping — falls entirely to the human.

That is not a bottleneck to remove. It is the job.

<div class="references">
  <div class="reference-item">
    <span class="ref-num">[1]</span>
    <div class="ref-text">Salomon, I. (2024). <em>AgentCraft: Putting the orc in orchestration</em> [Video]. YouTube. AI Engineer World's Fair. https://www.youtube.com/watch?v=kR64LOqBBCU</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[2]</span>
    <div class="ref-text">Zou, H. P., Huang, W. C., Wu, Y., Miao, C., Li, D., Liu, A., Zhou, Y., Chen, Y., Zhang, W., Li, Y., Fang, L., Jiang, R., & Yu, P. S. (2025). <em>A call for collaborative intelligence: Why human-agent systems should precede AI autonomy</em>. arXiv. https://arxiv.org/abs/2506.09420v1</div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[3]</span>
    <div class="ref-text">Ronacher, A., & Poncela Cubeiro, C. (2024). <em>The friction is your judgment</em> [Video]. YouTube. AI Engineer World's Fair. <a href="https://www.youtube.com/watch?v=_Zcw_sVF6hU" target="_blank" rel="noopener">youtube.com</a></div>
  </div>
  <div class="reference-item">
    <span class="ref-num">[4]</span>
    <div class="ref-text">Huang, W. C., Zhang, W., Liang, Y., Bei, Y., Chen, Y., Feng, T., Pan, X., Tan, Z., Wang, Y., Wei, T., Wu, S., Xu, R., Yang, L., Yang, R., Yang, W., Yeh, C. Y., Zhang, H., Zhang, H., Zhu, S., Zou, H. P., ... & Shu, K. (2026). <em>Rethinking memory mechanisms of foundation agents in the second half: A survey</em>. arXiv. https://arxiv.org/abs/2602.06052v3</div>
  </div>
</div>
