# Session 3: Data Collection and Sourcing
**Detailed session summary** · 16 July 2026 · 165 minutes · ~50 participants

*Sources: the live session transcript, and the official lesson page "Session 3: Data Collection and Sourcing" (Axiom, 13 sections).*

---

## The one sentence

> **At frontier scale, the training corpus is not a folder of downloaded files but a highly engineered system that determines the final model's capabilities.**

This session focuses on the collection, balancing, and filtering of pretraining datasets. It discusses scaling limits, data mixtures, the sovereign Indic data problem, license compliance, and the proxy run methodology used to validate recipes before full training runs.

---

## 1. Scale & Budgets: The Overtraining Paradigm
Historically, Chinchilla scaling laws dictated that the compute-optimal training point is roughly **20 tokens per parameter**:
- **Overtraining**: Modern frontier models (like Llama 4 at 30T tokens or Qwen3 at 36T tokens) train far past the compute-optimal point.
- **Why Overtrain?**: While it increases pretraining costs, it results in smaller, faster models that are significantly cheaper to serve during inference over billions of user queries.
- **Repetition Limits**: When high-quality human data is exhausted, repeating data is a fallback. Repetition is effective up to **4 passes**, but benefits diminish rapidly and approach zero by **16 passes**.

---

## 2. Operational Tiers of the Pretraining Corpus
A structured pretraining corpus (like the LightningLM reference) is divided into distinct operational tiers:
1. **Main Pretraining Pools (D1 to D4)**: Tiered from high-quality curated web crawls down to broad web text, code, scientific literature, and mathematical proofs. An **OPUS classifier** evaluates candidates, retaining only the top 40%.
2. **Always-On Channel (8% of batch)**: Excluded from classifier-based selection. It guarantees that low-resource scripts (like Indic languages) and benchmark format-familiarity splits maintain a stable share of every batch, preventing them from being erased by English-tuned quality filters.
3. **Golden Proxy (Held-Out Evaluation)**: A firewalled, immutable dataset used to measure model progress. It is strictly forbidden from ever entering the training loop to prevent benchmark contamination.

---

## 3. Data Modalities & Capabilities Mapping
Data composition directly decides capabilities. We map sources to target benchmarks:
- **Code Data**: Teaches exact structure, decomposition, variable tracking, symbolic manipulation, and long-dependency reasoning.
- **DeepSeekMath Mining Loop**: Uses a high-quality mathematics seed to train a classifier, mines additional math text from the web, and iterates. This loop scales a small, trusted seed into a 120-billion-token high-quality mathematical corpus.

---

## 4. Quality Filtering & Deduplication
- **Classifier-Based Filtering (FineWeb-Edu)**:
  - A highly capable teacher model (e.g. GPT-4) scores a small dataset sample for educational value, correctness, and structure.
  - A smaller, fast classifier learns these score labels and filters the full, multi-terabyte web corpus on CPU/GPU clusters.
- **Deduplication Scope**:
  - Global deduplication removes more redundant data but can discard high-quality older crawls.
  - FineWeb uses **per-snapshot deduplication** to preserve crawl-specific quality while eliminating intra-snapshot duplicates.

---

## 5. The Low-Resource Indic Data Problem
Indic language token counts on the web are frequently inflated by low-quality machine translations:
- **Verified Human-Origin Split**:
  - In the *Sangraha* dataset, separating verified human-origin text causes Telugu to fall from 16.3B tokens to 3.7B, and Odia from 12.5B to 1.2B.
- **English Filter Bias**: Quality classifiers trained on English often penalize Indic scripts, code-mixed writing, and local websites. A strict, uncalibrated filter will discard low-resource data faster than English, highlighting the necessity of the "always-on" batch reservation.

---

## 6. HTML Extraction & The Anneal Phase
- **Extraction Garbage**: Naive HTML stripping leaves navigation, boilerplate, cookie banners, and entities in the corpus, wasting token budget. Browser-based rendering and DOM extraction are required.
- **Annealing (Learning Rate Cooldown)**:
  - During the final 1-10% of pretraining, the learning rate decays to zero.
  - Feeding a small, highly concentrated mixture of mathematical proofs, clean code, and reasoning steps during this phase drastically boosts downstream benchmarks (e.g. OLMo 2 math scores rising from 24% to 67%).
  - This high-quality anneal corpus must be planned and reserved before the run begins.

---

## 7. Proxy Runs & Verification
No pretraining recipe should be run on intuition. Candidate mixtures, thresholds, and filters are verified on **1B and 3B parameter proxy models** first.
- The proxy model does not need to hit the final target score; it must **rank-order** the candidate mixtures reliably, saving millions of dollars in wasted compute by pruning suboptimal recipes early.
