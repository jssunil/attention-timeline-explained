# ERA V5 Session 7 — Assignment Plan

## Recommendation: **Problem 5 (reversibility), reframed**

With **Problem 3 (dynamic window)** as the low-risk fallback, and a collision audit from Problem 3 included inside the Problem 5 submission as a diagnostic (not as a second solution).

### Why 5

The instructor has been stuck on this for two years, and the transcript reveals *why*: he framed it as **inverting a float vector**. His attempted direction was VAE/KL — predict a distribution instead of a point, so approximate predictions are tolerated. That framing is genuinely hard, because a trained network never emits the exact 8,096-float code, and cosine similarity (the obvious fallback) fails at initialization in high dimensions — which he correctly identified in class.

**The reframe that makes it tractable: don't invert the float vector. Predict the discrete grid instead.**

The Kronecker code isn't really a float vector — it's a `256 × 32` grid of one-hot marks, i.e. **32 independent 256-way categorical choices** (one byte value per position). So the output head shouldn't try to regress a continuous target at all. It should emit `32 × 256 = 8,192` logits, softmax each group of 256, and argmax to recover the bytes. Decoding is then **exact and discrete**, trained with ordinary cross-entropy. No VAE, no distance metric, no KL term needed.

This is the same move that made the input side work. Kronecker replaced "look up a row in a `V × D` table" with "compute a row from bytes." The mirror is: replace "score against all `V` rows in a `D × V` table" with "predict the bytes." Vocabulary size vanishes from both ends.

### The numbers that make the claim

| Component | Dense | Kronecker byte-grid |
|---|---|---|
| Output head at V=131,072, D=8,096 | `8,096 × 131,072` = **1.06B** | `8,096 × 8,192` = **66.3M** |
| Same at V=1,000,000 | **8.1B** | **66.3M** (unchanged) |
| Training memory @16 B/param | 16.98 GB → 129 GB | **1.06 GB, flat** |

The headline plot writes itself: sweep vocabulary from 16K to 1M on the x-axis, plot output-head parameters on the y-axis. Dense is a straight line through the roof. Byte-grid is horizontal. That single chart *is* the instructor's stated goal ("then we can have a vocab of 1M as well without any issues").

If the tied variant works, input and output share **one** `8,192 × D` matrix — the model's entire vocabulary interface becomes a single 66M-parameter tensor, replacing 2.12B. That is the actual "get rid of the final head" claim, made literal.

---

## What to build

### Core module

```
KroneckerHead(nn.Module):
    # h: [B, T, D]  ->  logits: [B, T, 32, 256]
    # loss: mean over 32 positions of CE(logits[:,:,p,:], byte_target[:,:,p])
    # decode: argmax over dim -1 -> 32 bytes -> strip padding -> UTF-8 token
```

Two decode modes to compare:
- **Parallel** — all 32 byte positions predicted independently from `h`. Fast, but assumes conditional independence between byte slots given the hidden state. This is the known weak point (same issue as non-autoregressive decoding).
- **Local autoregressive** — a tiny 1–2 layer transformer over the 32 byte slots, conditioned on `h`, predicting bytes left to right within the token. Fixes conditional independence at small cost. This is the MegaByte / Byte Latent Transformer pattern, so there's prior art to cite rather than reinvent.

### Constrained decoding

Build a trie over the real vocabulary's byte sequences. At inference, mask logits to bytes that keep the prefix valid. Report accuracy both **unconstrained** (does it emit valid tokens on its own?) and **constrained** (does it pick the right one when restricted?). The gap between these two numbers is itself a result worth reporting.

---

## Experimental design

Small transformer, single GPU, a few hours per run. Suggested config: `d_model=384`, 6 layers, 6 heads, seq 512, vocab ~32K trained on a mixed English + one Indic script corpus (Hindi or Telugu — this matters, see failure modes). ~50–100M tokens is enough for the comparison to be meaningful.

Five arms, each a single variable change:

| Arm | Input path | Output head | Tests |
|---|---|---|---|
| **A** | Dense table | Dense `D×V` | Baseline |
| **B** | Kronecker | Dense `D×V` | Current V4/V5 design |
| **C** | Kronecker | Byte-grid, parallel decode | The core claim |
| **D** | Kronecker | Byte-grid + local AR decoder | Does fixing conditional independence recover the gap? |
| **E** | Kronecker | Byte-grid, **tied** to input projection | True reversibility — one matrix, both directions |

Arm E is the interesting one and the one most likely to surprise. Note the lesson chose *untied* for V5's dense head, but that argument was about a 1B-parameter saving being a rounding error against a geometric constraint. Here the shared tensor is 66M and the geometric argument (input geometry = output geometry, since both are literally the byte codec) is much stronger. Treat it as an open question, not an assumption.

---

## Metrics — what actually proves it

**Primary**
- Validation loss / perplexity per arm. C and D should land within a small margin of A/B, or the claim fails.
- **Exact token recovery accuracy** — the direct measure of reversibility. Report unconstrained and trie-constrained.
- Parameters and training memory (full 16 B/param AdamW accounting, matching Section 3's method).

**The scaling result (the paper's figure)**
- Hold the model fixed, sweep vocabulary 16K → 1M, plot output-head params and training memory. Dense explodes, byte-grid is flat. This needs no training — it's arithmetic — but pair it with at least two *trained* vocabulary points so it isn't purely theoretical.

**Secondary, and worth having**
- Per-script breakdown of exact-recovery accuracy (English vs. Indic). Almost certainly asymmetric.
- Throughput (tokens/sec) — the 16x smaller head should also be faster; measure it rather than assume it.
- Rare-token recovery vs. frequent-token recovery. Since Section 2 established that rare rows are undertrained in a dense head, a byte-grid head *should* help here (rare tokens share byte statistics with common ones). If it does, that's a bonus finding worth its own paragraph.

---

## Failure modes to test honestly

Section 12 of the LightningLM paper is an entire chapter on evidence boundaries, and Section 7 is a catalogue of failures. Match that standard — document what breaks, not just what works.

1. **Collisions kill reversibility outright.** If two tokens share their first 32 bytes they have identical codes, so no output head can ever distinguish them. This is the Section 8 problem arriving from the other direction. Measure the collision count on your actual vocabulary *before* training and report it as a ceiling on achievable accuracy. This is where Problem 3 legitimately enters your submission — as a diagnostic bound, not as a second solution.
2. **Conditional independence.** Arm C may produce byte sequences that are individually plausible but jointly invalid. Quantify: what fraction of unconstrained predictions are not valid vocabulary tokens? Arm D exists to answer whether a local decoder fixes it.
3. **Loss scale mismatch.** 32 cross-entropy terms vs. one changes gradient magnitude reaching the trunk. Check whether the arms need different learning rates to be a fair comparison — if you don't check this, a reviewer will assume you tuned one arm and not the other.
4. **Padding.** Short tokens use few of 32 slots. Decide explicitly whether padded positions contribute loss (they shouldn't) and state it.
5. **Indic degradation.** Three bytes per character means Indic tokens use more slots and have more opportunity to collide. If per-script accuracy diverges sharply, that is a real result about the technique's limits, not a bug to hide.

---

## Rough sequence

1. Collision audit on the target vocabulary, per script. Establishes the accuracy ceiling. Fast, and independently useful to the cohort.
2. Implement `KroneckerHead` + the byte-decode path. Unit test: encode → decode round-trip on the full vocabulary should recover every non-colliding token exactly, with zero training. This is the correctness gate — if it fails here, nothing downstream matters.
3. Train arms A and C first. This is the go/no-go: if C's perplexity is catastrophic, pivot to Problem 3 immediately rather than burning time.
4. Add arms B, D, E.
5. Scaling sweep + plots.
6. README with the figures, the honest failure table, and an explicit prior-work section.

---

## Positioning against prior work (do not skip this)

Byte-level and character-level output heads are not new. Adaptive softmax, hierarchical softmax, MegaByte (Yu et al., 2023), and Meta's Byte Latent Transformer all attack the large-vocabulary output problem. **The specific contribution here is narrower and should be stated as such:** making the output head the *exact structural inverse of the Kronecker input codec*, so that one shared byte/position basis serves both directions and vocabulary size disappears from the entire token interface — plus the empirical question of whether tying that shared projection helps or hurts.

Claiming novelty you don't have is the fastest way to lose a reviewer. Claiming a narrow contribution precisely is how the LightningLM paper itself is written ("None of the underlying primitives is new... What is new at the systems level is the integration").

---

## Fallback: Problem 3, if time or compute is tight

Genuinely lower risk, and the instructor explicitly stated in class that 1–3 are prerequisites for 4 and 5 — so it is not a consolation prize.

**Core idea:** the 32-byte cap is an artifact of using a *one-hot* position basis. Swap it for a continuous one and both problems dissolve at once — short tokens stop wasting slots, long tokens stop being truncated.

Candidate approaches, in order of how cleanly they'd demonstrate:
- **Sinusoidal / Fourier byte-position features.** Replace the one-hot position factor with `sin/cos` features of the byte index (optionally normalized by token length so the encoding is relative rather than absolute). Grid becomes `256 × k` where `k` is a small feature count, independent of maximum token length. Unbounded length, no waste.
- **Length-normalized relative position.** Encode position as `p / L` rather than absolute `p`, making the code scale-invariant to token length — which also means "training" and "trainingxyz" stay close rather than diverging.
- **Hierarchical/chunked encoding** for very long tokens: encode in chunks and pool, so length degrades gracefully instead of hitting a cliff.

**Proof:** collision counts per script before and after, at matched parameter budgets; plus a small training run showing perplexity is not harmed. The headline result is a table showing Indic collisions dropping to zero at unchanged or lower parameter cost than simply raising `pos_dim` to 64 (which the lesson notes costs ~133M).

---

## Notes on the other three

**Problem 1 (mathematical structure)** is more tractable than it looks — append a small block of dimensions holding `n` linearly (so vector addition = numeric addition) and `log|n|` (so vector addition = multiplication). But there's a real tension worth surfacing: adding the linear rail of 9 and 9 gives 18 while adding the log rail gives log 81, so the summed vector isn't a valid encoding of any single number under both readouts simultaneously. Resolving that — perhaps by having the operator token select which rail the readout trusts — is the actual research question, and it's a nice one. Lower ceiling than 5, but a clean, self-contained result.

**Problem 2 (multimodal)** has one genuinely elegant observation available: mu-law encoded audio has **256 levels** and image channels have **256 levels** — both are natively "byte" alphabets, exactly matching the existing 256-row grid. The construction transfers almost unchanged; you swap "byte position in token" for "patch position in image/window position in audio." The problem is proof cost — demonstrating this needs a multimodal training setup, which is heavy for an assignment timeline.

**Problem 4 (Fourier)** is the instructor's original idea and the highest ceiling — he stated that solving it resolves 1, 2, and 3 automatically. The literature to start from is **Holographic Reduced Representations** (Plate, 1995) and Vector Symbolic Architectures: bind a character to a position via circular convolution, superpose (add) the bound pairs to form the word, and unbind via circular correlation. That gives literally "represent each character as a wave and add them to make a word," *and* it's approximately invertible — which is why it brushes against Problem 5 too. The risk is that HRR's unbinding is noisy and capacity-limited; making it work at a 131K vocabulary is a research project, not a weekend. Highest reward, highest chance of not converging in time.
