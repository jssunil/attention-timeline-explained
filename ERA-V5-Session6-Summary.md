# ERA V5 — Session 6: Building the Training Data Execution System
**Detailed session summary** · Axiom / The School of AI (TSAI) · Compiled from lesson slides, interactive widgets, and the live session transcript

*Sources: the official Axiom lesson page ("Session 6 - Building the Dataset," 14+ numbered sections and 9 interactive widgets) and the full live session transcript. Where the transcript adds detail, numbers, or color beyond the slides, this is noted explicitly.*

---

## The one sentence

> **Session 5 defines the recipe. Session 6 builds the system that executes it at scale, correctly, reproducibly, and auditably.**

Session 5 produced a training data *recipe*: capability buckets, protected floors, curriculum stages, annealing reserves, OPUS selection policy, and benchmark-backed mixture targets. That design is only useful if the training system can execute it accurately, consistently, and reproducibly. Session 6 turns the recipe into the actual data stream a training loop consumes — token windows, loss masks, attention masks, position IDs, mixture tags, and packed microbatches — and keeps that stream correct across many workers, many GPUs, training restarts, and checkpoint boundaries.

The instructor called this session personally one of his most important contributions to the course — "the diamond sitting on top of" the Session 5 data-recipe work — because getting the data-execution system wrong silently corrupts everything Session 5 designed.

---

## 1. What this session inherits

Every prior session imposes a contract that Session 6 must satisfy:

| Session | Contract |
|---|---|
| **1 — Transformer Foundations** | The model predicts the next token, loss applies only to intended tokens, attention operates within a bounded context window. |
| **2 — Tokenization & Vocabulary Design** | The same raw text must always produce the same token IDs, using canonical special tokens and Indic-safe normalization. A shard is only meaningful under the exact tokenizer that created it. |
| **3 — Data Collection & Sourcing** | Every source carries provenance, license status, held-out status, capability tags, and token accounting. |
| **4 — Data Cleaning & Deduplication** | Only cleaned, deduplicated, PII-screened, contamination-scanned data may enter the stream, with reproducible transformation lineage. |
| **5 — Data Mixtures & Curriculum** | The mixture recipe: protected floors, OPUS policy, curriculum stages, anneal reserve, benchmark-backed shares. |

A **requirements ledger** traces every decision from Sessions 1–5 into a concrete obligation for the data system: next-token loss maps, tokenizer hashes, source provenance, cleaning manifests, evaluation firewalls, mixture floors, OPUS logs, annealing reserves. The guiding principle:

> **The dataloader is downstream of every design choice made so far.**

The rest of the session follows one piece of data through the system: **cleaned text → packed batch → ledger event → next corpus version.**

---

## 2. The vocabulary of a training step

Before discussing sharding and dataloaders, the session fixes shared vocabulary for what the training loop actually consumes:

- **Token** — the integer ID produced by the tokenizer.
- **Sequence** — a fixed-length window of tokens (e.g. 4,096 / 8,192 / 32,768 tokens).
- **Sample** — one training example handed to the model. In pretraining, a sample is usually one fixed-length token sequence. In SFT or agentic training, a sample may bundle multiple fields: prompt tokens, response tokens, tool observations, masks, labels.
- **Microbatch** — the small batch processed by *one GPU* before gradients are accumulated.
- **Global batch** — the complete set of samples, across **all GPUs** and **all gradient accumulation steps**, that contributes to **one optimizer update**.
- **Training step** — one optimizer update.
- **Checkpoint step** — a training step at which enough state is saved to resume training: model weights, optimizer state, scheduler state, RNG state, and dataloader state.

### The batch-size formula

```
global batch (tokens) = GPUs × microbatch/GPU × sequence length × gradient accumulation steps
```

Worked example from the session: **8 GPUs × 32 microbatch × 4,096 sequence length ≈ 1.05M tokens** — hitting the target of roughly **1 million tokens per optimizer step**, which the transcript cites as the sweet spot used by large labs (acceptable range ~0.5M–4M tokens; 1M is treated as a practical floor/target).

### Gradient accumulation

Gradient accumulation exists because GPU memory limits how large a microbatch can be. Instead of one forward/backward pass followed immediately by an optimizer update, several microbatches run in sequence, their gradients summed in a buffer, and only after the full accumulation count is the optimizer step actually taken.

**Analogy used in the session:** paying off a large bill in installments because a single transfer is capped — each transfer is a microbatch's gradient computation; the running tally is the accumulation buffer; the final "debt settled" event is the optimizer step.

Backpropagation itself runs on *every* microbatch/accumulation round — it is only the optimizer update that is held back until accumulation completes.

**Transcript color:** the instructor described gradient accumulation as necessary when a large model or long context leaves room for only a very small microbatch (e.g. a hypothetical 120B-parameter model at 32K context might only fit a microbatch of 2), requiring several accumulation steps to still reach the ~1M-token target. He joked about disliking gradient accumulation ("it feels like I'm poor") but confirmed it is unavoidable at scale.

### No concept of "epoch" in pretraining

The transcript confirms explicitly: **at LLM pretraining scale, there is effectively no epoch** — the whole run is treated as one pass, and teams do not deliberately retrain on repeated data when enough fresh data exists. (An "epoch" as a bookkeeping concept still applies in the interactive widgets' toy examples, e.g. a small toy dataset completing in a few thousand steps — but this doesn't reflect real trillion-token pretraining runs.)

### Checkpoints

A checkpoint must save: **model weights, optimizer state, scheduler state, RNG state, and dataloader state.**

- **Scheduler state** — which step the run is at, and therefore what learning rate to apply (e.g. mid-warmup vs. mid-decay). Missing this on resume can re-trigger a warmup phase and distort the schedule.
- **RNG state** — the exact internal state of the random number generator (dropout masks, shuffling order, sample selection). Missing this breaks bit-for-bit reproducibility of the resumed run.
- **Dataloader state** — exactly which data position training had reached, so a resume doesn't skip or repeat batches.

**Checkpoint frequency is a cost tradeoff, not a fixed interval.** Checkpointing too often wastes GPU-hours (idle time while writing large optimizer states to disk); checkpointing too rarely risks losing large amounts of expensive compute if a crash or instability occurs. The transcript states cadence should be tied to **money spent**, not an arbitrary step count.

**Transcript numbers:** a real training node in this course used an AWS **p4de.24xlarge** instance — 96 vCPUs, 1,152 GiB (~1TB) RAM, 8× NVIDIA A100 80GB GPUs (640GB total GPU RAM), ~₹2,700/hour. A 120B-parameter model's checkpoint file was cited at roughly **90GB**, with around 1TB of CPU RAM needed to build/compare checkpoints.

---

## 3. Documents become training sequences

Humans think in documents; training operates on fixed-length token windows. A cleaned document (already carrying provenance and quality metadata from earlier sessions) moves through a fixed transformation:

```
clean document
  → token IDs
  → token spans
  → packed sequence
  → microbatch
  → global batch
  → optimizer step
```

- The document is tokenized into **token IDs**.
- Those IDs are divided into **spans**.
- Spans are packed into **fixed-length sequences**.
- Sequences are grouped into **microbatches**.
- Microbatches are accumulated into **global batches**.
- Only then does the optimizer update the model.

Throughout this transformation, the system must preserve the **meaning and boundaries** of the original data, via:

- **EOS token** — may mark the end of a document.
- **Document ID** — may identify the source that produced a token span.
- **Loss mask** — determines whether a token contributes to the gradient.
- **Attention mask** — determines which earlier tokens each token can attend to.
- **Position IDs** — tell the model where each token sits inside the sequence.

**The batch therefore needs to carry more than token IDs — it must also carry the training meaning of those token IDs.**

### Loss-masking patterns by training mode

- **Plain pretraining:** most tokens receive next-token prediction loss.
- **SFT:** the prompt provides context (masked, no loss); the assistant response receives loss.
- **Agentic training:** the user request and tool observations act as context (masked); the model's planning, tool calls, and final response receive loss.

*(This generalizes Session 5's 9-step whiteboard example: user turns masked, assistant messages/tool calls in the loss, tool returns masked.)*

### EOS / BOS — transcript detail

The transcript clarifies that **BOS is treated as redundant** given EOS is present — "waste of space, so only EOS is covered" — though some organizations do use both or BOS-only; it's described as a largely arbitrary implementation choice. The analogy given for EOS: like a school's 7:30 a.m. English class ending and Hindi class starting — it resets attention so the model doesn't keep attending across unrelated prior context.

A live Q&A exchange addressed **why EOS matters even though the model could in principle learn boundaries implicitly**: the instructor's answer was that backpropagation will "immediately tell you you're using the EOS in the wrong way" — i.e., EOS correctness is self-reinforcing via the gradient signal on the token immediately following a boundary.

---

## 4. Padding, and why it hurts

Training systems prefer fixed shapes; natural text does not arrive in fixed shapes. If a model expects sequences of **8,192 tokens** and an example only has **2,700 tokens**, the simplest fix is padding up to 8,192 — solving the shape problem but creating a **compute problem**. Padding consumes token positions that occupy memory, pass through parts of the model, and reduce useful tokens processed per second.

### Types of padding

- **Right padding** — pad tokens added after the real tokens. Common when batching short examples together.
- **Left padding** — pad tokens added before the real tokens. More common in batched inference than pretraining.
- **Batch-level padding** — pad every example only to the length of the *longest example in that batch* (dynamic padding).
- **Fixed-context padding** — pad every sample to the model's full context length regardless of batch content (most wasteful).
- **Within-pack holes** — unused space left over when multiple examples are packed into one fixed window but don't fill it exactly.

**Transcript detail on right vs. left padding:** left padding is marginally better because a model trained with right padding can learn to "coast" by predicting long runs of trailing padding, which is a trivially easy, near-zero-loss pattern — effectively free reward for predicting nothing. The instructor's analogy: being paid to sit in a chair for 8 hours vs. actually being evaluated on real work. Left padding reduces how much of this "free" low-effort learning occurs. Both waste compute, but naive right-padding can actively distort training incentives.

### FAQ: three questions students often ask

**Can we cut a document in the middle of a line?**
For plain next-token pretraining — **yes**. Training on spans cut from a longer document is usually acceptable; the model learns local continuation patterns across billions of spans, and the sequence boundary is primarily an engineering boundary. However, careless cuts can damage code blocks, tables, proofs, agent trajectories, and instruction–response examples where structure matters.

*Transcript expansion:* cutting mid-document is explicitly fine for long plain-text works ("Vedanta texts, the Mahabharata, Shakespeare, long poems... you can cut them in the middle, not a problem") but is **not** fine for **code** (cutting a 16K-token file mid-function destroys it — code needs reserved, uncut placement, often deferred to longer-context training stages) and **not** fine for **SFT/agentic traces**, where "structure-preserving" packing is required instead.

**Can we fill the remaining window with a different topic?**
For plain pretraining — **yes**. Documents are often concatenated with EOS boundaries, so one training window may contain the end of one document and the beginning of another; the EOS token tells the model that one text ended. For SFT, agentic data, and reasoning traces, placing unrelated samples inside the same attention-visible context can teach unnatural transitions **unless masks and boundaries isolate them**.

**Does the boundary matter if the model only predicts the next token?**
**Yes.** Without explicit boundaries, the model may learn that unrelated text is a natural continuation. Boundaries prevent accidental continuations between documents.

---

## 5. Packing policies

Different packing strategies trade off *utilization* (how full each fixed-length window is) against *boundary risk* (whether unrelated content leaks into the same attention-visible context):

1. **Pad-only** — simplest, most wasteful; enables the "predict the padding" free-loss problem above.
2. **Concatenate-and-drop** — chain documents together in a sequence; drop whatever remainder doesn't fit.
3. **Greedy packing** — place each example into the first sequence with available space. Fast but suboptimal, leaving fragmented remainders. *Transcript analogy: "packing 5 minutes before you have to leave for the airport."*
4. **Best-fit packing** — sorts/buckets examples by length and places each into the tightest available space; requires knowing the dataset's length distribution in advance (effectively a bin-packing problem). Improves utilization further, especially with many short examples. *Transcript analogy: packing carefully for "an international trip."*
5. **Structure-preserving packing** — adds rules for SFT, tool-use, and agentic data so unrelated examples never leak into each other through attention; required whenever two independent traces must never be concatenated into the same sequence.
6. **Long-context packing** — handled separately because long-context batches are expensive; every unused position wastes a high-value training opportunity.

### Policy depends on data type

- **Plain web text** usually tolerates concatenation.
- **Code** may tolerate spans but benefits from preserving file or function boundaries.
- **Agentic trajectories** must preserve the order of tool observations, calls, and final answers.
- **Reasoning traces** need enough room to complete the argument.

> **Evaluation shards must never be casually packed into training.**

**Transcript detail — tokenizer fertility affects chopping frequency:** a poorly-fit tokenizer for a language can dramatically increase how often documents must be chopped. Example given: Telugu might require ~13 tokens per word under a poor tokenizer, turning a 1,000-word document into ~13,000 tokens (far more spans, far more chopping) versus a well-fit tokenizer with fertility ~1.3 needing far less.

---

## 6. Shards and manifests

Tokenization is expensive, but more importantly it must be **frozen** — the training loop must consume tokenized shards whose contents are tied to one exact tokenizer version.

A **shard** is an **immutable training object**. It may be stored as:

- Indexed binary token arrays (for pretraining).
- Structured records (for SFT and agentic training).
- Sharded tar-style objects (when each example bundles multiple related files).

Storage format may vary by training stage; **manifest discipline must remain consistent.**

### Shard manifest fields

A useful shard manifest records: shard ID, source IDs, document IDs, tokenizer hash, token count, language and script, capability lane, license and provenance tier, cleaning pipeline hash, deduplication status, contamination status, evaluation/test overlap status, content hash, and parent manifest/shard IDs (for lineage of derived shards).

A shard **cannot be admitted to training** unless it carries, at minimum, a tokenizer hash and a minimum-cleaning hash (PII screening, etc.).

**Transcript sizing detail:** a shard is sized so a GPU cluster can train roughly **1,000 steps** before needing the next download. Worked example: 32 microbatch × 8 GPUs × 4,096 tokens × ~1,000 steps ≈ **10 billion tokens per shard**. (This is larger than the ~1B-token convention from general industry precedent discussed earlier in this course — the exact size is a tunable engineering choice balancing file-count overhead, parallelism granularity, network-egress cost, and restart granularity.)

### The Shard Manifest Builder (interactive widget)

An accompanying widget lets you configure a candidate shard (capability lane, token count, license tier, and which checks passed: tokenizer hash, cleaning hash, dedup passed, no eval overlap, PII screened, parent manifest) and shows whether it is **admitted to registry**. A fully-passing example (General web, 284M tokens, "Verified commercial safe" license, all checks green) produces a complete JSON manifest:

```json
{
  "shard_id": "v5_general_web_shard_284",
  "capability_lane": "General web",
  "token_count": 284000000,
  "tokenizer_hash": "tok_df8ad00fb2d7",
  "content_hash": "sha256_db30c76e6181",
  "cleaning_pipeline_hash": "clean_fe40758ff874",
  "dedup_status": "passed",
  "pii_screen_status": "screened",
  "eval_overlap_status": "clear",
  "license_tier": "safe",
  "parent_manifest_ids": ["manifest_2026_07_a"],
  "admission": "Admitted to registry"
}
```

**Teaching point:** the manifest is the contract between Sessions 1–5 and the dataloader. If a shard is replayed later, the same tokenizer, source lineage, and safety state must still be knowable.

---

## 7. Mixture becomes an executable schedule

A **Mixture Timeline Compiler** widget converts a Session 5 mixture plan into a per-step executable schedule, checking real supply against required tokens after OPUS rejection.

Example run (240B total token budget, "Balanced V5" curriculum profile, 6% warmup band, 18% OPUS rejection rate) compiled into three curriculum bands — **Foundation (0–132B), Skill build (132B–204B), Anneal (204B–240B)** — with lane shares General 45%, Code 20%, Indic 12%, Reasoning 15%, Agentic 8%.

Checking required supply after OPUS rejection against verified supply, **every lane showed a shortfall** in this example (e.g. General needed 131.7B but only 95B verified; Indic needed 35.1B but only 18B verified). The compiler's warning: when supply is insufficient after rejection, options are to **lower the share, collect more data, use repetition deliberately, or protect only the highest-value subset** — directly operationalizing Session 5's point that a 25% Indic target "cannot be met from verified sources alone... defines how much synthetic data must be created."

**Transcript nuance on OPUS rejection and supply:** the OPUS rejection rate directly multiplies how much raw data must be collected. If OPUS rejects roughly half of candidates, the raw collection requirement roughly doubles to hit the same net trained-token target — a compounding cost of pursuing a highly selective OPUS policy.

---

## 8. Why the ledger matters

Imagine an old checkpoint and two strategies to compare from it.

**Strategy 1:** restore the checkpoint and let the dataloader produce whatever the *current* seed, worker count, and shard set generate. The model starts from old weights, but the data stream has silently changed — if the new strategy performs better, you cannot determine whether the improvement came from the strategy or from seeing different data.

**Strategy 2:** restore the checkpoint and bind the run to a **ledger branch**. The run can either replay the historical data segment exactly, or intentionally fork into a new branch where every data difference is explicit. Now both model state and data stream are defined, making the result comparable.

This gives the rule for serious training experiments:

```
experiment = model checkpoint + optimizer state + data stream + code/config
```

**If any one of these changes silently, the comparison is weakened.**

### Checkpoint Comparison Lab (interactive widget)

Demonstrates this concretely: Run A ("No ledger" — loader samples again) drew a batch sequence that included a **test** tag mid-run — exactly the contamination risk the earlier "evaluation shards must never be casually packed into training" rule warns against. Run B ("Ledger backed" — replay or explicit fork) produced an evenly structured, fully traceable sequence. Stats: **50% comparison confidence without ledger vs. 100% stream identity with replay.**

### Transcript detail — determinism as the underlying requirement

The instructor demonstrated with a real loss-curve graph that identical data + identical code should reproduce an identical loss curve exactly; any divergence signals something changed (different shard order, library nondeterminism, mismatched CUDA kernel version). This determinism requirement is what the ledger exists to guarantee: it records *what shard was actually sent* at each step, so non-deterministic ordering can be replayed exactly rather than approximately recomputed.

---

## 9. OPUS audit trail

OPUS sits inside the data path — its decisions are training events, not disposable preprocessing. In Session 5, OPUS selected candidate batches by estimating which updates would be most useful against a proxy direction, meaning the data stream contains **both accepted batches and candidates that were scored and rejected.**

Those rejections are valuable — they show: what the selector considered low value, what protected floors rescued, what the model was already comfortable with, and what may deserve review in a later phase.

### Ledger fields per candidate batch

Candidate ID, shard IDs, capability lane, curriculum stage, model checkpoint used for scoring, proxy version, OPUS score, accepted/rejected/deferred status, rejection reason.

This directly fixes a named **V4 mistake** from Session 5: *"OPUS selections weren't saved. Rejected samples had to be re-evaluated instead of permanently excluded."*

**Transcript mechanics, with numbers:** OPUS sends roughly **1,000 candidate samples**, each potentially up to 32,000 tokens, but scores using only the **first 512 tokens** (matching how OPUS itself was trained/calibrated). Candidates are compared against an OPUS weight-update map; samples that don't move the currently-flagged (undertrained) weights are discarded. Of the initial 1,000, roughly **~200 are kept** and trained on the full sequence length.

**Transcript's most emphasized idea — gradient-magnitude drift as a quality signal:** for every OPUS selection pass, log the dataset/shard ID, curriculum stage, and the **average gradient magnitude of the selected samples**. If a later pass on the same shard shows the average gradient of the top-selected fraction dropping sharply compared to an earlier pass (worked example: ~0.6 down to ~0.005), that signals the shard's remaining data is being scraped for scraps — "OPUS is selecting these 25% because it has nothing else to select... it's like marrying the old data." This can also expose when OPUS's proxy target itself is mismatched to the desired capability (e.g., OPUS selects for "coding" but the coding benchmark stays weak, implying the coding proxy data was the wrong kind of code).

The instructor called this idea, repeatedly and emphatically, one of the most valuable in the session — "no company in the world is ever going to share this data."

---

## 10. Token-level perplexity trace

The most detailed learning signal appears at the **token level**. For every loss-bearing token, the model computes cross-entropy:

```
loss_t = -log p(true token_t)
```

Token perplexity is:

```
ppl_t = exp(loss_t)
```

At this moment, the model tells us how surprising each token was. **If this signal is discarded, recovering it later requires re-running the same model over the same data at the same training state** — expensive, and may never be reproduced cleanly at large scale.

### Why per-token perplexity matters

Per-token perplexity reveals patterns that shard-level averages hide:

- An **Indic shard** may have acceptable average loss while a specific conjunct, joiner pattern, or transliterated phrase remains consistently difficult.
- A **code shard** may appear useful overall while indentation, rare library calls, or error messages carry most of the difficulty.
- An **agentic trajectory** may be easy in the final answer but difficult in the tool-call arguments.
- A **long reasoning trace** may become easier at the beginning while remaining high-perplexity near the verification step.

### What the trace can record per loss-bearing token

Token ID, and (from the fuller slide list) associated position, mask status, boundary marker, and capability lane — demonstrated concretely in the **Document to Batch Transformer** widget, which showed a real 24-token Indic packed window with 13 non-pad tokens, 13 loss-bearing tokens, a boundary marker, and the "indic" capability lane tag attached.

### Perplexity math and interpretation — transcript detail

- Loss = -ln(p); perplexity = e^loss (natural log, explicitly *not* log base 10).
- For an untrained model with vocabulary size **V**, expected initial loss ≈ **ln(V)**. For a **131,072-token vocabulary** (V4's actual vocab size), initial loss should start around **~11.78**.
- Milestones offered: a well-trained run's loss lands around **~1.8** near the end; **under 1.0 is called "miraculous"**; **~0.6–0.65** is compared to GPT-4/ChatGPT-level performance.
- **The single biggest stated regret from V4:** not logging shard-level average loss during training. If a shard shows loss ~1.2 partway through training while the model's current overall average loss is 2.3, that shard is **already learned** — continuing to spend compute on it at that stage is wasted. The instructor called this a ~10-line-of-code omission he wishes he'd made in V4, directly usable for V5/V6 shard scheduling.
- **Chicken-and-egg nuance (raised in Q&A):** you can't know a shard's perplexity is low because it's "easy/already learned" versus "genuinely low-value" until *after* you've trained on it once. The resolution: this becomes usable knowledge from the point the perplexity ledger exists onward — reuse a shard in a *different* training phase than where it was already observed as low-perplexity, rather than re-feeding it into the same stage where it's already been learned.
- Perplexity behavior is described as roughly comparable across different model architectures, since most large models are architecturally ~90% similar (the instructor's estimate) — so patterns of difficulty transfer reasonably well across models.
- A distinct, related risk flagged: models can fluently memorize low-value "garbage" content (e.g., GNU license boilerplate repeated across many code files) purely through repetition, without the model "understanding" it — analogous to rote-memorizing a poem without comprehension.

---

## 11. The two-way learning ledger

The **consumption ledger** records what the model saw. The **learning ledger** attaches the outcome back to the data.

For each shard, sample, capability lane, or token cluster, the learning ledger can record: average token loss, high-perplexity token clusters, loss delta before and after exposure, gradient norm, gradient alignment (where available), OPUS score, repeated-pass effect, model phase (early/mid/late/anneal), tokens consumed when the data was seen, and a useful/neutral/harmful classification for future planning.

This creates feedback for the next training run:

- High OPUS score + strong early loss improvement → likely **useful foundation data**.
- High OPUS score but little loss reduction → the **proxy may be overvaluing** it.
- OPUS rejected a shard but perplexity remained high for that language/pattern → the **proxy may be missing a scarce capability**.
- Repeated passes stop improving loss → the **repetition budget is exhausted**.
- A shard causes gradient spikes → it may require **cleaning, staging, or a warmup band**.

*(This last point ties directly to Session 5's V4 incident: a sudden increase in Hindi share interacting with frozen embeddings caused a ~150× gradient-norm spike — the rule afterward being that mixture transitions must always be blended across a warmup band, never changed in one hard step.)*

---

## 12. Training Consumption Ledger (interactive widget)

An **append-only** log of what was actually consumed during training — step, rank, microbatch, packed span IDs, masks, OPUS decision, checkpoint binding. Its defining principle:

> **The ledger stores facts after consumption, not just intentions before training.**

Each committed batch event is tagged by capability lane and carries a full JSON payload, e.g.:

```json
{
  "event": "batch_committed",
  "ledger_offset": 64,
  "run_branch_id": "run-a",
  "global_step": 64,
  "checkpoint_id": "none",
  "created_at": "2026-08-01T03:09:11.954Z",
  "rank": 0,
  "microbatch_count": 4,
  "packed_sample_ids": ["sample_0_bf95777e", "..."]
}
```

This is the concrete implementation of the "dataloader state" checkpoint requirement from Section 2 — proof of exactly which data was consumed up to any given step, enabling accurate resume after a crash.

---

## 13. Resume, replay, and fork

Large training runs are interrupted. The data system must define exactly what happens next. **Four modes:**

- **Resume** — continues the same run from the latest checkpoint and the latest ledger offset. The normal crash-recovery path.
- **Replay** — restores an older checkpoint and feeds the same historical data stream from that point. Useful when comparing a code or training change under identical data exposure.
- **Fork** — restores a checkpoint and intentionally starts a new data branch. The new branch receives a new ID, and the ledger records the exact point of divergence.
- **Audit** — reconstructs the data that trained a checkpoint or range of checkpoints. Answers questions such as: *Which shards influenced the model between 5.4B and 5.6B tokens? Which OPUS-selected batches appeared before a loss spike?*

> **Checkpointing therefore binds model state to data state. A checkpoint without a data position is incomplete.**

---

## 14. Dataloader throughput

Correctness alone does not keep GPUs busy. The dataloader must deliver **useful tokens** faster than the GPUs consume them. Throughput depends on: shard size, compression, storage bandwidth, local caching, prefetch depth, worker count, rank partitioning, packing efficiency, OPUS rejection rate.

- Small files create overhead; very large files reduce flexibility and make recovery difficult.
- Compression saves storage/network bandwidth but consumes CPU.
- Prefetching hides latency but uses memory.
- More workers help — until they saturate the storage system or compete with each other.
- **OPUS may improve token *value* while reducing accepted-token *throughput*** if candidate generation and scoring are slow — a real tension between OPUS's quality benefit (Session 5's cited 6–8× effective token value) and raw pipeline speed.

**The metric that actually matters: "useful loss-bearing tokens per second at the target mixture."** A loader may report high raw token throughput while still wasting compute on padding, context-only (masked) tokens, or batches rejected by OPUS. Recommended monitoring: raw tokens/sec, useful loss-bearing tokens/sec, accepted tokens/sec after OPUS, GPU idle time, loader wait time, cache hit rate, shard read latency, packing utilization, rejection rate by lane, replay and resume latency.

### Transcript detail — ZeRO and real GPU-memory math

A worked toy example: a model with 20GB of weights and 140GB of activations cannot fit on a single 80GB GPU either combined or separately. Splitting the model's memory footprint across 8 GPUs (640GB total, via **ZeRO — Zero Redundancy Optimizer**) makes it fit. ZeRO's stages progressively shard more state across GPUs instead of duplicating it on every GPU:

- **ZeRO Stage 1** — partitions optimizer states only.
- **ZeRO Stage 2** — partitions optimizer states *and* gradients.
- **ZeRO Stage 3** — also partitions the model parameters themselves.

The transcript confirms V4 training used **all three ZeRO stages at different times** during the run. This is what makes training models far larger than a single GPU's memory (e.g. V4's 58B–120B parameter scale ladder) possible on 8-GPU nodes.

**Transcript detail — real ops timing and cost:** time from GPU boot to first training step ranged from an **8–9 hour failure case** (broken library versions) in early V4 attempts down to **~10 minutes** after optimization (Docker image pinning to fix CUDA kernel-version mismatches, custom fused kernels turning "10 seconds per step into 1 second," and persistent network volumes to avoid reinstalling the environment on every new instance — described as avoiding "installing Windows and all your applications" fresh each time).

---

## 15. The assignment: build a small but complete Training Data Execution System

The system must implement the **full path**:

```
documents
  → tokenized shards
  → manifests
  → mixture schedule
  → packing
  → batches
  → training
  → consumption ledger
  → learning ledger
  → checkpoint
  → crash
  → resume
  → replay
  → audit
```

**Scope:** the implementation may use a small corpus, tokenizer, and model. The goal is **not scale** — it is to prove the data system is **correct, reproducible, auditable, and efficient.**

### The system must demonstrate

- Immutable tokenized shards with manifests.
- Frozen tokenizer and content hashes.
- Packing policies for different data types.
- Correct loss masks, attention masks, and position IDs.
- Curriculum stages, lane weights, and protected floors.
- Evaluation and validation firewalls.
- OPUS acceptance, rejection, deferral, and protected-floor override.
- Training consumption and learning ledgers.
- Token-level or sample-level loss tracking.
- Checkpoints tied to ledger offsets.
- Crash recovery without skipped or repeated batches.
- Replay of the same historical data stream.
- Forking from an earlier checkpoint.
- Packing utilization and useful loss-bearing tokens per second.

### The core proof requirement

> The final run must **deliberately crash**, resume from the saved checkpoint, and prove that the next batch is exactly the expected batch. It must also **replay** an earlier interval and prove that the reconstructed batch IDs, token spans, and hashes match the original run exactly.

### Submission

A **GitHub repository** containing:

1. The complete implementation.
2. A short README explaining architecture and design decisions.
3. **One command** that runs the complete demonstration (e.g. `python run_demo.py`), executing the full demo without manual intervention.
4. Automated tests for the important invariants.
5. A generated execution log.
6. A machine-readable evidence bundle.
7. Generated manifests, ledgers, checkpoints, and performance reports — output under a `submission_artifacts/` folder (e.g. `run.log`, `evidence.json`, `evidence.md`, ...).

### Transcript grading and scope clarifications

- **Fake or very small data is explicitly acceptable** — *"for this assignment even a fake dataset would work... keep your dataset small, don't make me download a terabyte."* Grading targets pipeline correctness, not real token counts or realistic scale.
- **Scoring: 1,150 points total** — 1,000 points for the core pipeline, 150 points for supplementary links (README, logs, evidence).
- The instructor distinguished today's **data ledger** from a separate, future **training ledger** (hyperparameters and training state) — not covered in this session, planned for later.

---

## 16. Notable transcript color (not in the slides)

A few things that only appear in the live transcript, useful for context but not strictly required to understand the technical content:

- **Opening anecdote:** a father's three sons were investigated after a school's online test scores were hacked; the culprit was his third-grade son, who used an AI assistant to alter grades — deliberately keeping his own score at 95–96 rather than 100 to avoid suspicion. Used to underscore why training must be "controlled, inspectable, and replayable," even though (per the instructor) models don't yet have this kind of self-serving "consciousness."
- **NRI-parenting analogy** for why protected data (e.g. Indic languages) must be fed *continuously* through training rather than saved entirely for a late "anneal" stage — comparing it to children needing regular native-language practice throughout childhood, not crammed at the end.
- **Nvidia/memory economics tangent:** a student noted much of Nvidia's practical value chain runs through memory suppliers (Hynix/Samsung) as much as raw compute; another noted AMD still lacks a true CUDA-competitive cross-compiler after many years.
- **Sri Lanka capital quiz** used live to illustrate high-perplexity/low-confidence tokens (most answered "Colombo"; the administrative capital is technically Sri Jayawardenepura Kotte).
- **Commitment/ops-culture statement:** a candid expectation-setting moment for anyone joining the "training team" — real runs may require being reachable at 2 a.m., taking leave from day jobs, and being on call through unstable training phases.
- **Closing tangent on bias and rationale for Indic/agentic focus:** the instructor argued that most of India's population doesn't operate primarily in English, and that native-language capability matters for legal, land, and agricultural documents, as well as for genuinely understanding non-English communications — framing this as a deliberate counterweight to English/US/Europe-centric bias baked into existing frontier models' training data and benchmark culture.
- Confirmed upcoming topics: embeddings, attention variants, loss functions, optimizers, ZeRO (in depth), and pipeline parallelism.
- Confirmed the course's training-system code will eventually be **open-sourced**.
- Live project board referenced: `https://github.com/orgs/The-School-of-AI/projects/1` (the real "Lightning LM V1.0 ERA V4" tracker, with 30 active workstreams spanning data acquisition, tokenizer design, MoE architecture, reproducibility/provenance, training operations, and more).

---

## 17. Terminology (Session 6 additions)

| Term | Meaning |
|---|---|
| **Microbatch** | The small batch processed by one GPU before gradients are accumulated. |
| **Global batch** | All sequences, across all GPUs and accumulation steps, contributing to one optimizer update. |
| **Gradient accumulation** | Running several microbatches' backward passes before firing one optimizer update, to simulate a larger batch than memory allows. |
| **Checkpoint step** | A training step where model weights, optimizer state, scheduler state, RNG state, and dataloader state are all saved together. |
| **Shard** | An immutable, versioned, manifest-carrying unit of tokenized training data. |
| **Manifest** | Per-shard metadata proving tokenizer version, cleaning lineage, dedup/contamination/eval-overlap status, and license tier. |
| **Consumption ledger** | Append-only record of exactly what data was fed to the model, batch by batch. |
| **Learning ledger** | Record of the *effect* that consumed data had (loss delta, gradient norm, OPUS score), feeding back into future mixture decisions. |
| **Resume** | Continue the same run from the latest checkpoint and ledger offset (crash recovery). |
| **Replay** | Restore an older checkpoint and feed the identical historical data stream from that point. |
| **Fork** | Restore a checkpoint and intentionally start a new, explicitly-diverging data branch. |
| **Audit** | Reconstruct exactly what data trained a checkpoint or range of checkpoints. |
| **Token-level perplexity trace** | Per-token loss/perplexity logging, revealing difficulty patterns that shard-level averages hide. |
| **ZeRO (Zero Redundancy Optimizer)** | Technique for sharding optimizer states, gradients, and/or model parameters across GPUs instead of duplicating them, enabling training of models larger than a single GPU's memory. |

---

## Closing framing

> **"The dataloader is downstream of every design choice made so far."**

Session 5 decided *what* the model should learn and *in what proportion*. Session 6 is the machinery that guarantees the model actually receives exactly that — correctly shaped, correctly masked, correctly ordered, and provably reproducible after any crash, replay, or fork. Get this system wrong, and every carefully-designed mixture and curriculum decision from Session 5 silently fails to reach the model as intended.
