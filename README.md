# The Attention Timeline: How Transformers Learned to Pay Less

An interactive, chronological visual guide to every attention and positional encoding mechanism covered in **ERA V5 Session 8** — from standard scaled dot-product attention (2017) to DeepSeek's Compressed Sparse Attention (2026).

Deployed Live Link: *(Insert your deployed Vercel/Netlify link here)*

---

## The Thesis

> **"Every technique in this timeline is the same trade: substituting structure for stored parameters buys generalization and costs expressiveness."** — Session 7

Vanilla attention from the original Transformer was not mathematically wrong; it was simply computationally and memory-wise **expensive**. As context windows grew from 2K to 128K and beyond, serving these models became a major bottleneck. This timeline maps how the AI research community iterated on positional encodings, key-value cache compression, and sparsity to reduce the cost of attention.

---

## Chronology & Source Verification

To prevent "AI hallucination" of paper release dates, every launch date in the timeline has been cross-referenced against the original preprints on arXiv or official repository release tags:

1. **Scaled Dot-Product Attention** (June 2017)
   - *Paper*: "Attention Is All You Need" (Vaswani et al.)
   - *arXiv Date*: 12 Jun 2017 ([arXiv:1706.03762](https://arxiv.org/abs/1706.03762))
2. **Sinusoidal Positional Encoding** (June 2017)
   - *Paper*: "Attention Is All You Need" (Vaswani et al.)
   - *arXiv Date*: 12 Jun 2017 ([arXiv:1706.03762](https://arxiv.org/abs/1706.03762))
3. **Absolute Learned Positional Embeddings** (June 2018 / October 2018)
   - *Paper*: "Improving Language Understanding by Generative Pre-Training" (Radford et al. / GPT-1) released Jun 2018.
   - *Paper*: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding" (Devlin et al.) released Oct 2018 ([arXiv:1810.04805](https://arxiv.org/abs/1810.04805))
4. **Multi-Query Attention (MQA)** (September 2019)
   - *Paper*: "Fast Transformer Decoding: One Write-Head is All You Need" (Noam Shazeer)
   - *arXiv Date*: 11 Sep 2019 ([arXiv:1911.02150](https://arxiv.org/abs/1911.02150))
5. **Sliding Window Attention** (April 2020)
   - *Paper*: "Longformer: The Long-Document Transformer" (Beltagy et al.)
   - *arXiv Date*: 10 Apr 2020 ([arXiv:2004.05150](https://arxiv.org/abs/2004.05150))
6. **Linear Attention** (June 2020)
   - *Paper*: "Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention" (Katharopoulos et al.)
   - *arXiv Date*: 15 Jun 2020 ([arXiv:2006.16236](https://arxiv.org/abs/2006.16236))
7. **Delta Rule / Fast Weight Programmers** (February 2021)
   - *Paper*: "Linear Transformers Are Secretly Fast Weight Programmers" (Schlag, Irie, Schmidhuber)
   - *arXiv Date*: 22 Feb 2021 ([arXiv:2102.11174](https://arxiv.org/abs/2102.11174))
8. **RoPE (Rotary Position Embedding)** (April 2021)
   - *Paper*: "RoFormer: Enhanced Transformer with Rotary Position Embedding" (Su et al.)
   - *arXiv Date*: 20 Apr 2021 ([arXiv:2104.09864](https://arxiv.org/abs/2104.09864))
9. **ALiBi (Attention with Linear Biases)** (August 2021)
   - *Paper*: "Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation" (Press, Smith, Lewis)
   - *arXiv Date*: 27 Aug 2021 ([arXiv:2108.12409](https://arxiv.org/abs/2108.12409))
10. **Flash Attention** (May 2022)
    - *Paper*: "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness" (Dao et al.)
    - *arXiv Date*: 27 May 2022 ([arXiv:2205.14135](https://arxiv.org/abs/2205.14135))
11. **Grouped-Query Attention (GQA)** (May 2023)
    - *Paper*: "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints" (Ainslie et al.)
    - *arXiv Date*: 22 May 2023 ([arXiv:2305.13245](https://arxiv.org/abs/2305.13245))
12. **NTK-Aware RoPE Scaling** (June 2023)
    - *Source*: First proposed by Reddit user `bloc97` on r/LocalLLaMA on 29 Jun 2023. Later adapted into various models.
13. **Attention Sinks** (September 2023)
    - *Paper*: "Efficient Streaming Language Models with Attention Sinks" (Xiao et al.)
    - *arXiv Date*: 29 Sep 2023 ([arXiv:2309.17453](https://arxiv.org/abs/2309.17453))
14. **YaRN** (September 2023)
    - *Paper*: "YaRN: Efficient Context Window Extension of Large Language Models" (Peng et al.)
    - *arXiv Date*: 31 Aug 2023 / 1 Sep 2023 ([arXiv:2309.00071](https://arxiv.org/abs/2309.00071))
15. **MLA (Multi-head Latent Attention)** (May 2024)
    - *Paper*: "DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model"
    - *arXiv Date*: 6 May 2024 ([arXiv:2405.04434](https://arxiv.org/abs/2405.04434))
16. **Gated DeltaNet** (March 2025)
    - *Paper*: "Gated Delta Networks: Improving Mamba2 with Delta Rule" (Yang et al.)
    - *arXiv Date*: 6 Mar 2025 (and preprint [arXiv:2412.06464](https://arxiv.org/abs/2412.06464))
17. **DroPE (Dropped Position Encodings)** (December 2025)
    - *Paper*: "Extending the Context of Pretrained LLMs by Dropping Their Positional Embeddings" (Gelberg et al.)
    - *arXiv Date*: 17 Dec 2025 ([arXiv:2512.12167](https://arxiv.org/abs/2512.12167))
18. **Compressed & Sparse Attention / CSA** (April 2026)
    - *Source*: "DeepSeek-V4 Technical Report", Preview released 24 Apr 2026.

---

## Features

- **Interactive Timeline Grid**: Visual navigation representing major chronological milestones.
- **Trade-off Matrix (What it Buys vs. Costs)**: No marketing — honest representation of what the model gains and what it gives up.
- **Embedded SVG Visualizations**: Explains technical concepts (like RoPE rotations, Causal Masking, GQA Cache Reduction, Delta Updates) directly in-browser.
- **Dual-Mechanism Comparison**: Select any two mechanisms and see their attributes and trade-offs side-by-side.

---

## Local Setup & Development

To run the application locally:

```bash
# Clone the repository
git clone <repo-url>
cd 008_session

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```
