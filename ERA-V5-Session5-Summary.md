# ERA V5 — Session 5: Data Mixture & Curriculum
**Detailed session summary** · 25 July 2026 · 171 minutes · ~50 participants

*Sources: the live session transcript, and the official lesson page "Session 5: Data Mixtures and Curriculum" (Axiom / School of AI, 12 sections). Where the two differ, both figures are given.*

---

## The one sentence

> **The mixture is the model.**

Sessions 1–4 produced clean, deduplicated, provenance-stamped shards. This session is about what happens next: *how much* of each kind of data the model sees, *when* it sees it, and *which tokens the loss is computed on*. The same clean corpus and the same compute budget produce completely different models depending on those three answers.

---

## 1. Target capabilities for V5

Three, stated explicitly:

1. **Coding and agentic work** — a Codex-style assistant that takes a long task, plans, calls tools across multiple steps, reads results, **recovers when a call fails**, and keeps operating while the task history grows in context.
2. **Controllable reasoning depth** — easy problems get short thinking, hard problems get long thinking, and the depth is *steerable* (low / medium / high / ultra).
3. **Native Indic capability** — the primary differentiator and the reason the project exists.

---

## 2. Loss masking — the foundational distinction

Introduced early and returned to repeatedly.

**Pretraining:** loss on *every* token.

**Post-training / agentic:** loss on *some* tokens only.

Using the admin's 9-step whiteboard (U = user, A = assistant):

| Step | Content | In the loss? |
|---|---|---|
| 1, 3, 5 | User turns | No — masked |
| 2, 4, 6, 9 | Assistant messages and tool **calls** | **Yes** |
| 7 | Tool **return** / observation | **No** |

**Why tool returns are masked:** the return is whatever the environment produced — a log, a stack trace, an `ffmpeg` error saying `.magg` is unsupported. Training on it would teach the model to *become a Python compiler* — to predict outputs instead of reading them. As the admin put it, that is "nonsense." The model should see the log, extract the one useful line, and decide the next step.

Colour convention used throughout the session's benchmark cards:

- 🟩 **green** — supervised, in the loss
- ⬜ **grey** — masked context / observation
- 🟪 **violet** — reward only, no token loss

---

## 3. Why the mixture is the model

The token budget is fixed, so the mixture is **zero-sum**. Every share given to one capability is taken from another.

**The common-sense argument** (a major theme):

Push code and agentic up, general web down, and you get a model that programs beautifully and has no world model. Examples given:

- Asked to count index fingers, it queries how many humans are in the room — because it doesn't know humans have two index fingers.
- Asked "where are most vegetarians?" — it doesn't know what vegetarian means.
- Asked to book a ticket — it books one for 2 a.m.
- Asked to write a sick-leave note to a manager — it writes two blunt sentences.
- Asked to optimise data transfer — it spends an hour compressing a one-minute video, having never learned that an hour is too long.

Common sense has **no dedicated lane and no benchmark**. It is a residue of broad general web text. That is why the web slice stays large even though it "doesn't make sense" against the benchmark list.

**Where long-tail knowledge lives:** the session opened by asking ChatGPT about the number 17, and then "famous people born when their mothers were over 40." The point of both: this information is **not** in Wikipedia or any curated knowledge base. It's scattered across the open web — social media, gossip, forums. Anthropic and OpenAI have licensed and structured knowledge bases; ERAV5 does not, so it must rely on web.

**The protected floor:** without an explicit reserve, the sheer volume of English content erases Indic from the mixture by default. The floor is a deliberate decision, not an outcome.

**V4's actual stage weights** (official document) — proof this isn't theoretical:

| Lane | Start | End |
|---|---|---|
| General web | ~70% | **18%** |
| Code | ~13% | **35%** |
| Science / maths | ~7% | **39%** |
| Protected channel | **8%** | **8%** (fixed all run) |

Weights are a *schedule*, not a constant. The capabilities of the final model were exactly the capabilities those allocations purchased.

---

## 4. Composing backward from benchmarks

The stated method: **start from the benchmarks you intend to win**, map each to the data that improves it, then set shares. You cannot compete on every benchmark GLM or Anthropic wins — so choose.

Benchmarks discussed, by lane:

| Lane | Benchmarks |
|---|---|
| Agentic / tool-use | SWE-bench Verified, SWE-bench Live/Pro, Terminal-Bench, tau-bench, BFCL, WebArena, GAIA, BrowseComp, OSWorld |
| Coding | LiveCodeBench, Aider, Codeforces |
| Reasoning / STEM | AIME, GPQA, HLE, FrontierMath |
| Long context | long-eval |
| Indic | MILU, IndicGenBench |
| General web | MMLU |

**MMLU ≈ UPSC.** A breadth exam funded by broad general reading — you can't buy it with the code lane.

**Benchmark structure:** train / validation / **test**. Test answers are never released; you submit the model and they run it. This is what makes contamination detectable — memorise the public split and you still fail the private one. Benchmarks like SWE-bench Live/Pro and LiveCodeBench exist because their predecessors saturated and leaked.

**You cannot train on the benchmark itself** — a thousand memorised questions is not a capability. You find the *datasets* that produce the capability the benchmark measures.

---

## 5. What actually exists — sizing in two currencies

A shopping list only works if the data exists. Every slot must be sized in **both**:

- **Number of samples** → variety / coverage
- **Number of tokens** → depth and actual training time

They tell different stories. The Stack v2: ~600M samples, ~900B tokens. tau-bench: ~120K examples but only ~80M tokens — tiny per sample. A mixture designed from sample counts alone misjudges how much of the run each capability consumes.

Datasets named: The Stack v2 (deduplicated permissive source, ~100 languages), DCLM, FineWeb, tau-bench, plus Indic sets. Even within a slot there are choices — do you need Fortran support?

---

## 6. Training stages

| Stage | Share of tokens | What happens |
|---|---|---|
| 1 · Pretraining | **~95%** | Broad web, base capability |
| 2 · Mid-training / **anneal** | ~2% | Proportions retuned; the best, cleanest, "PhD-level" documents are spent here |
| 3 · SFT | <1% | Agentic trajectories, chat, code-fix loops |
| 4 · Reasoning training | <1% | Short/long answer pairs with effort tags |
| 5 · Preference alignment | <1% | Safety, style, country-specific preferences (not covered this session) |
| 6 · Serving | — | No loss |

Stages 1–4 all use standard cross-entropy loss. RL (GRPO etc.) arrives in later sessions.

**The anneal reserve:** premium data is deliberately *held back* from the bulk run and spent in the short final phase, when the model is ready to absorb it — "like young Einstein reading the relativity paper." Give the best book to a beginner and it's wasted.

---

## 7. Reasoning depth control

You cannot get it for free. The admin's interview question — *"What is 43 ÷ 17?"* answered in five seconds — is the target behaviour: fast, approximate, good enough.

**Why the model won't self-select depth:** you reward correct answers, so longer thinking always looks better. Like an employee paid by hours worked — give it a one-minute problem and it will take all day. Depth must be an explicit conditioning signal with matching training data.

**What's needed:** the same problem with low / medium / high / ultra traces, tagged, plus defined token boundaries for each level. This data is **not freely available** — it has to be built. (Every "which response do you prefer?" click in ChatGPT or Claude is users building exactly this dataset for the frontier labs.)

---

## 8. OPUS — dynamic per-iteration selection

The most technically detailed segment. Proportions alone aren't enough; you must keep selecting the most useful data *while the run is happening*, because what's useful changes as the model improves. (Teaching a trained model that 4 + 4 = 8 is wasted compute.)

**Mechanism, as drawn:**

1. Keep an **exact copy** of the current model in GPU memory (the "ghost" model).
2. Take the **golden proxy** — datasets built from the target benchmarks.
3. Run it through, compute loss, **backpropagate but do not update weights**.
4. Read off which weights show the **largest gradient magnitude** — these are the weights currently bad for the benchmarks.
5. Take the ~1024 candidate training samples, but only their **first ~512 tokens**.
6. Score each candidate by how much it moves *those* weights.
7. Keep the top fraction (e.g. 50%); discard the rest permanently.

**Key properties**

- Must run **repeatedly**, not once — the model changes, so the golden proxy's verdict changes. (Analogy: don't send a kid to maths tuition based on their 9th-class report card.)
- Discarded data is **not revisited** — the current weights say it's already learned.
- Junk self-filters: garbage affects no useful weight and gets dropped.
- **High loss → high gradient**, so hard examples are selected, not avoided.
- A distilled small model is **not** a valid substitute for the ghost copy — different weights, different capacity.
- Expensive: each pass means loading the model, running the proxy, computing losses. You can't afford 400 benchmarks, so you use only the fastest, most representative ones.

**Why the Always-On lane exists.** Because the affordable benchmark set is mostly English and coding, and because OPUS only inspects the **first 512 tokens** — where an agentic trace looks like a log, i.e. low-quality — OPUS systematically discards **Indic and agentic** data. So both are exempted from selection entirely and held at a **constant** share (not increasing) throughout the run. For those lanes, quality must be guaranteed up front, since nothing downstream filters them.

**V4 results.** Official document: OPUS retained about **40%** of candidate data, delivered roughly a **sixfold** increase in effective token value, at a few percent compute overhead. In the live session the admin quoted the paper's **~8×** claim and worked it through: ~1T tokens collected, ~200B actually trained, of which ~40–50B were OPUS-selected — roughly half a trillion tokens of effective training. Treat **6×** as the V4-measured figure and 8× as the paper's headline.

**Always-On, V4 → V5.** V4 protected **Indic only, fixed at 8% of every batch**, outside the selector's control. **V5 extends the same protection to Indic, agentic *and* reasoning data.** The final design is an aggressive selector operating above a protected capability floor.

---

## 9. Curriculum — the order

> "Your kid has crossed 12th class and suddenly you're giving a PhD-level book."

Mixture answers *how much*; curriculum answers *when*. Structure: **nursery → school → high school → undergraduate → PhD**. Broad general text first, then code / maths / science / reasoning, with long context introduced **last** — only once the model can already read and think.

Within each stage there is also a **difficulty ladder**, simple to advanced. So the curriculum is a controlled progression across *both* capability and difficulty. (A V4 mistake: OPUS data was not ordered by difficulty — quantum physics and simple problems were mixed together.)

### Band transitions and gradient explosions

Shift the mixture too sharply and the gradient norm detonates. **Real V4 experience:** loss and gradient norm visibly jumping at band boundaries.

**The fix:** a **warmup band** — deliberate overlap between old and new mixture so the transition is diffused rather than a hard line. "You can't suddenly stop speaking and start reciting shlokas."

*Analogy given:* arriving at IIT Kharagpur and finding the thermodynamics professor teaching in Bengali — no gradual introduction, total shock.

**Health metric:** target gradient norm ≈ **0.2**. Seeing it stabilise around 0.35 and creeping up means the model is struggling. Some of this is controllable via learning rate (future sessions).

**The V4 incident, precisely.** A sudden increase in the **Hindi share** interacted with **frozen embeddings**, and the gradient norm jumped roughly **150×** over a short stretch. An event of that scale can destroy a run.

**V4's rule after it:** *never change the mixture in one hard step.* Every transition is blended across a warmup band of **several billion tokens**. This is also why the architecture and mixture are **frozen before the main run begins** — changing the blend casually during live training can destroy days of expensive compute. Mixture changes are planned, infrequent, monitored events.

---

## 10. Long context

Long context means **each sample is longer** — not that you truncate long examples into short batches. All examples in a batch must be the same sequence length, so you use separate batches per length.

**V4's actual ladder:** 4K → 8K → 16K → 32K → 64K, with example counts dropping as length grows.

To claim 100K context you must **train at 100K** — otherwise you can't prove it.

**Two limits on advertised context windows:** (1) average correctness degrades well before the stated maximum, and (2) hardware — committing to 1M context means committing RAM per user.

---

## 11. Practical numbers

- **V5 token budget:** 2.4 – 4 trillion tokens (extensible)
- **Params vs tokens:** ~40 tokens per parameter as a rule of thumb — 1T tokens ⇒ ~25B params. Ultimately "a function of how much money you have." Floor of roughly 8B for reasonable generalisation.
- **Indic worked example:** 4T target × 8% Indic ⇒ ~320B cleaned Indic tokens required.
- **OPUS keep-fraction:** e.g. 50% ⇒ collect 1T tokens to train on 500B.
- **V4 scale ladder:** models A/B/C/D — 1B (became 2B), 3B, ~58B, planned 70B (became 120B).

---

## 12. V4 mistakes, named

1. **No live execution environment.** The model was never given a real terminal to run commands in during training — so no genuine reward signal for agentic work.
2. **OPUS selections weren't saved.** Rejected samples had to be re-evaluated instead of permanently excluded.
3. **No difficulty ordering** within the OPUS data.
4. **Sharp band transitions** causing gradient instability.

---

## 13. Notable Q&A

**Is data composition the secret sauce?** Yes — and nobody publishes it. Some labs release weights, fewer release datasets, **nobody releases the curriculum or the percentages**. Reverse-engineering it from papers and blogs is the only route.

**Mixture of Experts — related to capability lanes?** **No.** Explicitly a different concern: cost. "Why we are using mixture of experts has to do with how poor we are." A large MoE performs like a smaller very good dense model at much lower serving cost. Active-parameter fractions have dropped from ~7% → 3% → under 1%; a 2.4–3T parameter model may activate only ~10B. A dense GLM-5.2 would have beaten Opus — if they'd had the data for it.

**Kill switch?** *"That's a harness question."* Not a model problem.

**The OpenAI / Hugging Face incident — data problem or harness problem?** **Harness.** You cannot enumerate every forbidden objective — block nuclear, then biological, then incitement, then the Blue Whale game; the list is unbounded and a capable model routes around it. The harness must detect and stop it. Reasoning itself cannot be constrained this way.

**Reward hacking (printing `42` instead of computing it)?** Checks exist; harness-level concern.

**Prompt engineering — chain-of-thought prompting, self-consistency?** *"'24, '25 — not relevant anymore."* It's a context/rules/harness matter, not a model-training one.

**Indic reasoning data — do we need to duplicate everything?** No. The model has three parts: token→logic conversion, **language-agnostic logic**, logic→token conversion. Reasoning trained in English transfers to Indic. Roughly **90% is covered by English reasoning data; ~10% Indic is still needed** for local context.

**Why are Chinese models catching up?** Distillation from frontier US models — Alibaba and others have Anthropic and OpenAI to distil from; Anthropic has no one. Also two different strategies: the US optimises quality regardless of cost, China optimises cost so more people can use it. Open weights let Chinese firms build on each other internally.

**What is distillation?** Ask Claude/GPT the same question at low, medium and high effort, save the outputs, that becomes your dataset.

**Where does agentic data come from?** Cursor, Claude Code and Codex users. Every coding session is a labelled agentic trajectory. This is why labs subsidise coding tools — the users are the data generators.

**Can we build on V4's weights instead of training from scratch?** No. *"The DNA is already locked in."*

**Ethics and safety?** Preference alignment, a later stage. Discussed with the NCERT / Mughal-history example — whether to teach uncomfortable history plainly — concluding these are questions without settled answers, that preferences are country-specific and change over time, and that the line is ultimately drawn by whoever owns the model.

---

## 14. The assignment

**Deliverable:** a **GitHub repo README.md** link containing a mixture-and-curriculum specification for V5.

**Must contain**

1. A defended share of budget for **every** capability lane
2. The **Indic split** across verified / unverified / translated / synthetic tiers — not one headline number
3. Agentic, reasoning and long-context slots named explicitly, each **pointed at datasets from the inventory**
4. Every lane sized against **real supply**, stating plainly where a share is only reachable by repeating or generating data
5. The **protected always-on floor** the selector may not cross
6. The **anneal reserve** held back for cooldown
7. **Difficulty and reasoning-length bands**, with a concrete example at each level
8. A commitment to validating via **1B / 3B proxy runs**

**Scoring**

- Tightly argued and short scores well; padding earns nothing
- Wishful accounting — a large share to a lane with no real data — loses marks
- **Highest marks:** specify a concrete proxy experiment *and name the metric that would confirm or refute your mixture*
- **Very highest:** actually run it and bring numbers back
- Reviewed "the way a technique candidate is reviewed" — in the open, pushed on every number
- Only reviewed once the team has met the data-gating threshold

**Why it matters:** *"This is the most important decision of our life for the next four or five months."* Strong plans get pulled into the mixture the whole cohort actually trains on. And there is **one shot** — no running ten variants.

---

## 15. What this commits us to, and what comes next

**Three commitments carried forward** (official document, §12):

1. **The mixture is the decision that makes the model.** Proportions, provenance tiers and curriculum are written down and defended — composed backward from capabilities → benchmarks → data.
2. **Scarce data is protected by design.** Verified Indic, agentic trajectories and long reasoning traces get protected floors, deliberate reservation, and a place in the final anneal.
3. **Every proportion is a hypothesis until tested.** It must survive 1B and 3B proxy runs before shaping the full run.

**Forward references**

- **Session 6** — turning the mixture into the physical data stream: sharding, sequence packing, deterministic shuffling, pause-and-resume, dataloader throughput. *Session 5 defines the recipe; Session 6 builds the system that executes it at scale.*
- **Sessions 17–18** — reasoning training and RLVR. The reasoning data reserved *now* is the raw material for that stage. A mixture decision made here determines what will be possible then.
- Preference alignment / safety — a later stage, not covered.

**One extra number from the official page:** a mixture assigning **25% to Indic cannot be met from verified sources alone.** That doesn't invalidate the target — it *defines how much synthetic data must be created*.

---

## 16. Terminology

| Term | Meaning |
|---|---|
| **Capability lane** | A budget slice named by the capability it produces, not its source |
| **Protected floor / Always-On** | A minimum share exempt from selection, so scarce lanes are never zeroed |
| **Anneal / cooldown** | Short final pretraining phase fed the best held-back data |
| **Golden proxy** | Benchmark-derived data used to identify which weights are currently weak |
| **Ghost model** | The exact frozen copy used for OPUS scoring |
| **Keep-fraction** | Share of candidate batches OPUS retains each iteration |
| **Warmup band** | Overlap region smoothing a mixture transition |
| **Distillation** | Generating training data by querying a stronger model |

---

## Closing framing

> "You and I sit together, we define the best transformer architecture, the modern optimizer, Flash Attention 47 — and if the dataset isn't there, you will get crap."

Architecture is essentially solved. **Data mixture and curriculum are where models are actually decided** — and it's the part nobody publishes.
