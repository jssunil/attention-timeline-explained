# Session 2: Tokenization and Vocabulary Design
**Detailed session summary** · 9 July 2026 · 175 minutes · ~50 participants

*Sources: the live session transcript, and the official lesson page "Session 2: Tokenization and Vocabulary Design" (Axiom, 11 sections).*

---

## The one sentence

> **Tokenization is the load-bearing seam where raw text is converted into model input, permanently fixing sequence length, spelling limits, and multilingual equity.**

This session explores the design of vocabularies. It traces the trade-offs of subword tokenization algorithms, vocabulary scaling laws, the transition from tokens to continuous embeddings, and the unique challenges presented by Indic scripts.

---

## 1. The Tokenization Dilemma: Characters vs. Words
Before any neural network can process text, the text must be split into discrete units (tokens) and mapped to integer IDs:
- **Character Splitting**:
  - *Pros*: Tiny vocabulary size $V$, zero out-of-vocabulary (OOV) errors, compact embedding table.
  - *Cons*: Extremely long sequences (quadratic attention cost $O(T^2)$), and the model must waste capacity learning basic word spelling.
- **Word Splitting**:
  - *Pros*: Short sequence lengths, semantic units kept whole.
  - *Cons*: Vocabulary size $V$ grows without bound, typos/rare words trigger OOV errors (mapped to the `<UNK>` token), and morphologically rich languages fail.
- **Subword Tokenization (The Middle Path)**: Keeps frequent words whole while breaking rare words and typos into constituent subwords (morphemes or characters).

---

## 2. Subword Tokenization Algorithms
Three primary algorithms govern modern language modeling:
- **Byte-Pair Encoding (BPE)**:
  - Iteratively finds the most frequent pair of adjacent symbols in the corpus, merges them into a new vocabulary token, and records the merge rule.
  - Tokenization is deterministic and replayed in the exact order of learned merges.
- **WordPiece**:
  - Used in BERT. Instead of merging the most frequent pair, it merges the pair that maximizes the likelihood of the training corpus (preferring pairs whose constituents appear together more often than random chance would predict).
- **SentencePiece**:
  - Treats raw input as a raw Unicode stream, explicitly marking spaces with a spacer symbol (e.g. `_`).
  - Completely language-agnostic, requires no pre-tokenization (e.g. splitting by whitespace), and ensures perfect reversibility (lossless round-trip from tokens back to raw characters). This is critical for languages like Sanskrit, Hindi, or Chinese that do not use English-style word spacing.

---

## 3. The Seam: Token IDs to Embeddings & Kronecker Factorization
- **Vocabulary Size ($V$) as a Dial**:
  - A small vocabulary increases sequence length (increasing compute cost per sentence).
  - A large vocabulary decreases sequence length but causes the embedding table ($V \times D$ parameters) and output projection head ($D \times V$ parameters) to explode.
  - At $V = 131,072$ and $D = 8,096$, the embedding layer alone holds **over 1 billion parameters** (occupying gigabytes of memory before any transformer block).
- **Kronecker Factorized Embeddings**:
  - Resolves the embedding storage bottleneck by building token vectors on demand from their UTF-8 bytes.
  - Marks a grid of byte values against byte positions (a Kronecker product of two one-hot vectors).
  - A shared projection matrix maps this grid to the model's hidden dimension.
  - The parameter footprint becomes independent of the vocabulary size $V$, allowing arbitrary vocabulary scaling (even up to 1M+ tokens) without memory bloat.

---

## 4. Indic Script Challenges
Indic scripts (Devanagari, Telugu, Bengali, Odia, Tamil, etc.) present unique structural challenges for standard tokenizers:
- **Conjunct Consonant Fusion**: Consonants combine visually using a *halant* or *virama* (e.g. क् + ष = क्ष). Unicode stores these as multiple code points under the hood, which naive tokenizers frequently split.
- **Matras (Vowel Signs)**: Attach to consonants, creating complex grapheme clusters. Tokenizers must avoid slicing through the middle of these structures.
- **Joiners (ZWJ/ZWNJ)**: Zero-Width Joiner and Zero-Width Non-Joiner are invisible characters that modify script shapes and alter token boundaries.
- **Normalization Inconsistencies**: The same visual character can be represented by multiple byte sequences, requiring strict normalization before tokenization.
- **Equity Issues**: Standard English-centric tokenizers often split Indic scripts into 3-4x more tokens than English for the same meaning, resulting in 3-4x higher inference bills and reduced context window capacity for non-English users.

---

## 5. Tokenizer Design Assignment
- **Objective**: Design a joint BPE tokenizer over Wikipedia pages in English, Hindi, Telugu, and a fourth language.
- **Constraints**:
  - Vocab size $V = 10,000$.
  - English tokenization ratio $X_1 = \frac{\text{Total English Tokens}}{\text{Total English Words}} \le 1.2$.
  - Calculate ratios for other languages ($X_2, X_3, X_4$).
  - Score metric: $\text{Score} = \frac{1000}{X_{\text{max}} - X_{\text{min}}}$.
  - Encourages balancing tokenization efficiency across both high-resource and low-resource Indic languages to minimize the disparity.
