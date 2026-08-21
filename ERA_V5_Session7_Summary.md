# ERA V5 — Session 7 Summary: The Embedding Layer

Session 7 picks up exactly where Session 2 left off: text has been turned into a sequence of integers, and this session builds the first thing the model does with them — turning integers into vectors, and telling the model where each one sits in the sequence. Two unpaid debts from Session 2 (the size of the embedding table, and Kronecker factorization) get paid off here.

---

## Part 1 — The Seam

Session 6's dataloader hands the model five things per batch: token ids `[B,T]`, position ids, a loss mask, mixture/stage metadata, and ledger tags. Session 7 only touches the token ids. The boundary between "tokenizer's job" (text → integers) and "model's job" (integers → meaning) is treated as a hard contract: a token id is *an address, and nothing more*. If the tokenizer version changes silently, ids get silently reassigned to different tokens — which is why the tokenizer's hash/version has to travel with the data.

## Part 2 — The Dense Table: What It Actually Costs

**2. The lookup is a gather, not a matrix multiply.** The textbook "one-hot × matrix" description of an embedding layer is mathematically true but operationally misleading. The real operation is a **gather**: the token id is a memory offset, and the row at that offset is read — a memory read, not arithmetic.

The backward pass mirrors this: gradient only updates rows that appeared in the batch, via a **scatter-add** — one gradient term per occurrence of a token, summed into that row; every other row gets exactly zero.

**The Zipf problem.** Natural language is Zipfian (frequency ∝ 1/rank^s, s ≈ 1). At V5 scale (131,072-token vocabulary, global batch of 2,097,152 token positions), *coverage* isn't the issue — nearly every row is touched every step. The real asymmetry is in *how much* gradient each row gets: the most frequent token can contribute ~100,000+ gradient terms in one step, a tail token contributes ≤1 — a spread of five to six orders of magnitude. An interactive simulator demonstrated this live: after 40.6K simulated steps, the most frequent row had received 430.9K accumulated gradient terms vs. 17.9K for the least frequent — a 24x gap in a toy vocabulary of just 24 rows. **The embedding table is not one tensor training at one rate — it's thousands of small objects, each trained at a rate set by the corpus, not the optimizer.** This is the mechanism underneath why low-resource languages need protected/oversampled lanes in the training mixture (Session 5), and why **annealing** (the learning-rate decay phase at the end of training) compounds the problem — shrinking already-tiny updates for rare tokens even further, effectively freezing their embeddings wherever they landed earlier in training.

**3. What the table costs.** Parameter count is the easy part: input table is `V×D`, output projection is `D×V`. At V5's reference shape (V=131,072, D=8,096) each is **1.06B parameters**, 2.12B combined if untied.

The number that actually constrains training is *memory*, and it's much bigger than parameter count suggests. Under AdamW mixed precision, one parameter costs **16 bytes**, not 2: 2 bytes bf16 weight + 2 bytes bf16 gradient + 4 bytes fp32 master copy + 4 bytes each for Adam's two optimizer moments. The input table alone: **16.98 GB**. An untied pair: **~34 GB** — on an 80GB accelerator, that's ~42% of the card consumed by "the least interesting work in the model" (a lookup and a dot product), *before a single attention head has been placed*.

An interactive **Parameter and Memory Budget** tool showed this scales in a counter-intuitive way: at a larger configuration (293B total params, 96 layers, 12,288 width), the embedding tables shrank to just **1.0% of total parameters** — yet their memory burden on one accelerator got *worse* (67.1% of a 72GB card), because embedding memory scales with width (D), which had grown, independent of the parameter-share trend.

## Part 3 — The Fix: Kronecker Embeddings

**The Kronecker Microscope.** Instead of one learned row per token, a token's vector is built from its raw UTF-8 bytes: each byte is marked in a 256-row (byte value) × 32-column (byte position) grid — one mark per byte, which is a Kronecker product of two one-hot vectors (byte value ⊗ position). The grid is flattened (8,192 numbers) and passed through **one shared, trained linear projection** (8,192 × 8,096) to produce the final token vector. This projection is the *only* trained component — the byte-to-grid mapping itself is fixed by construction.

Result: **66.3M trainable parameters**, vs. 1.06B for a dense table — a **16x reduction** — and critically, **no V anywhere in that calculation**. Vocabulary size can grow arbitrarily without adding a single parameter.

**What you gain:** cost stops depending on vocabulary size at all; unseen tokens still get sensible codes (no untrained random row — the OOV problem effectively disappears); similar spellings (train/training/trainer) start out near each other in vector space, since they share bytes.

**What you pay:**
- The embedding layer now needs raw token text/bytes, not just the integer id — reaching back across the clean tokenizer/model boundary Session 2 established. A deliberate trade, not an accident.
- The codec is frozen by construction and never learns. **If two tokens produce the same code, no amount of training can separate them.**

**8. The thirty-two byte budget.** The 32-column grid means only the first 32 bytes of any token are ever seen (`L = min(len(byte_seq), pos_dim)`). For English (1 byte/char) this is generous — 32 characters. For Indic scripts (Devanagari, Telugu, Tamil, Bengali — 3 bytes/char in UTF-8), the same window holds only ~10 characters, and conjuncts (e.g. क्ष = 3 Unicode code points = 9 bytes for one visual character) can exhaust the budget in a single word. Two tokens sharing their first 32 bytes get **identical embeddings, permanently, with no error or warning**. The fix isn't automatic — it's decided empirically: encode the real vocabulary, count collisions per script. Doubling `pos_dim` to 64 doubles the projection to ~133M parameters — still 8x smaller than a dense table.

**9. The V4 scar.** A real historical incident: a sudden increase in the Hindi share of the training mixture, hitting *frozen* embeddings, spiked the gradient norm ~150x. Diagnosis: the embedding layer is the only place where corpus statistics meet continuous computation; if it's frozen, a mixture shift can't be absorbed there, so the shock propagates upward into layers not tuned for it. **Not a learning-rate problem — an adaptation-boundary problem.** Kronecker embeddings make this *worse*: a dense table has a billion independent degrees of freedom (it can move just the rows that need to move); a Kronecker path has only one shared projection, so every token adapts together or not at all. **Compressing the embedding and freezing it are two decisions that are each locally reasonable and jointly dangerous.**

## Part 4 — Position

**10. The model reads a set.** Attention computes pairwise scores from query/key vectors with nothing referencing sequence order — it's *equivariant to permutation*, meaning it cannot natively distinguish "dog bites man" from "man bites dog." Position must be deliberately supplied. (Session 2 proved this experimentally: a token-only model was pinned at chance on a task rigged with token-order swaps; a token+position model learned the rule.)

**11. The absolute table, and the wall at max_position.** The simplest fix mirrors the token table: a second lookup table indexed by position, added to the token vector (`x = token_embedding(ids) + position_embedding(arange(T))`) — what GPT-2 does. Cheap, but it **inherits the exact same gather/scatter-add training dynamics** as the token table. Rows beyond the trained max position either don't exist or sit at random initialization forever, injecting noise. **This is a hard wall, not a soft degradation — no signal in the parameters connects row 4,095 to row 4,096, because they were always independent rows.**

**Position Families** — the map of alternatives (only the first is built in Session 7; the rest come in Session 8):

| Family | Made of | Past the trained length |
|---|---|---|
| **Absolute learned** | Stored table, one row/position | Hard wall — undefined/untrained past max length |
| **Sinusoidal** | Fixed function of position, no parameters | Defined everywhere; usability past trained length is separate question |
| **Rotary (RoPE)** | Computed rotation on Q/K vectors | Degrades gracefully — "where the field has settled" |
| **Attention bias (ALiBi)** | Fixed distance-dependent score penalty | Extrapolates gracefully by design |

This is the same trade made twice already this session (dense→factorized table, factorized→Kronecker table): **substituting structure for stored parameters buys generalization and costs expressiveness, every time.**

Real-world confirmation: both **Llama 3.2 1B** and **Qwen3 0.6B** use RoPE for position, illustrating a classic width-vs-depth tradeoff (Llama: wider, 32 heads/8,192 hidden dim/16 layers/131k context; Qwen3: deeper, 16 heads/1,024 embed dim/28 layers/41k context, plus an added Q/K RMSNorm).

## Part 5 — The Assignment

Five open problems toward a possible "Kronecker Embedding V2" paper (pick **one**, prove it with a trained small transformer + code + README):

1. **Mathematical structure in embeddings** — could "9" encode arithmetic such that 9+9's embedding relates to 18's?
2. **Extend Kronecker to images/audio** — the same byte/position-grid idea generalized to multimodal patches.
3. **Dynamic window size** — today's fixed 32-slot grid wastes space on short tokens and truncates (collision risk) on long ones.
4. **A "real" Fourier alternative** — represent characters as continuous waves instead of one-hot grid marks.
5. **Reversible Kronecker** — make the forward (word→embedding) mapping invertible; if solved, the output projection head could be eliminated too, removing the last vocabulary-dependent cost in the model.

---

### Key numbers to remember
- Vocabulary: **131,072** tokens (V4 BrahmicTokenizer) · Reference width: **8,096**
- Dense embedding table: **1.06B params**, **16.98 GB** training memory (AdamW mixed precision, 16 bytes/param)
- Kronecker embedding: **66.3M params** — **16x smaller**, vocabulary-size-independent
- Byte window: **32 bytes** (`pos_dim`) — collision risk is real and measurable, especially for Brahmic scripts
