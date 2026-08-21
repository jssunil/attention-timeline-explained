# Session 4: Data Cleaning and Deduplication
**Detailed session summary** · 23 July 2026 · 168 minutes · ~50 participants

*Sources: the live session transcript, and the official lesson page "Session 4: Data Cleaning and Deduplication" (Axiom, 14 sections).*

---

## The one sentence

> **Cleaning is load-bearing systems engineering that transforms raw web crawls into high-signal training data by removing boilerplate, duplicates, PII, and evaluation leakages.**

This session outlines the technical stages of data cleaning. It details Unicode normalization, heuristic quality filters, MinHash LSH deduplication math, PII redaction, evaluation decontamination, and the structure of a reproducible data pipeline.

---

## 1. The Data Cleaning Pipeline
The cleaning pipeline processes raw text through a sequence of deterministic filters:
```
 Raw Text ──► Normalization ──► Quality Filter ──► MinHash LSH ──► Lang ID ──► PII Redaction ──► Decontamination ──► Manifest
```

---

## 2. Text Normalization & The Ghost-Tag Trap
- **Unicode Normalization**:
  - Web text contains inconsistent character encodings (e.g. `n` + `tilde` vs `ñ`).
  - The pipeline enforces **NFC (Normalization Form Canonical Composition)**, combining characters where possible, and strips invisible control characters and malformed bytes.
- **The Ghost-Tag Trap**:
  - Occurs when HTML parsers strip tags poorly, leaving fragments of code (e.g. `p>` or `<div`) or inline javascript.
  - These fragments split clean words, forcing the tokenizer to split them into subwords, inflating sequence lengths and introducing noise into the attention weights.

---

## 3. Heuristic Quality Filters
Heuristics quickly filter out non-language documents (spam, code dumps, log files, or gibberish) before expensive processing:
- **Length Filters**: Minimum and maximum character/word limits (e.g. discard documents with fewer than 100 characters or average word lengths $>15$ characters).
- **Symbol Ratios**: Ratios of punctuation-to-words, symbol-to-word, and uppercase-to-lowercase. Bullet-point lists or log lines are pruned.
- **Stop-Word Counts**: Discard documents that do not contain common stop words (e.g. "the", "and", "is" in English) to eliminate keyword-stuffed SEO spam.
- **Perplexity Filters**: Check document perplexity against a small reference language model. Highly repetitive texts or random character streams have high perplexity and are discarded.

---

## 4. Deduplication: MinHash & Locality-Sensitive Hashing (LSH)
Deduplication removes repeated documents, boilerplate headers, and leaked benchmark templates.
- **Exact Deduplication**: SHA-256 hashes of clean document strings or lines eliminate identical copies.
- **Fuzzy Deduplication (MinHash LSH)**:
  - Finds documents with high **Jaccard Similarity** (typically threshold $J(A, B) \ge 0.8$):
    $$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
  - **MinHash Signature**: Converts documents into sets of $n$-gram shingles. Applies $k$ independent hash functions (e.g., $k=128$) to the shingles. The minimum hash value for each function is retained, forming a signature vector.
  - **LSH Banding**: Signature vectors are divided into $b$ bands of $r$ rows. Documents that match exactly on all rows within at least one band are clustered as candidate duplicates. This reduces comparisons from $O(N^2)$ to near-linear $O(N)$.
- **Connected Components Search**: A distributed graph algorithm processes candidate pairs, building clusters of duplicate documents. The highest-quality representative from each cluster is kept, and the rest are deleted.

---

## 5. Language Identification & Validation
- **FastText Models**: Pre-trained FastText classifiers predict document language.
- **Threshold Constraints**: Documents that fail to meet the confidence threshold (e.g. $< 0.65$) are discarded.
- **Code-Mixing**: Validates multilingual documents containing mixed scripts (like Hinglish or Telugu-English) without over-filtering natural bilingual text.

---

## 6. PII Redaction & Decontamination
- **PII (Personally Identifiable Information) Redaction**:
  - Regex patterns and Named Entity Recognition (NER) models flag and redact IP addresses, phone numbers, emails, physical addresses, and social security numbers.
- **Decontamination (Evaluation Protection)**:
  - Prevents the model from training on test questions.
  - Extracts $N$-grams (e.g. 13-grams) from validation and test splits of downstream benchmarks (like MMLU, GSM8k, HumanEval).
  - Any training document containing overlapping $N$-grams is flagged and removed.
  - **Immutable Held-Out Sets**: The final evaluation splits are locked behind a cryptographic firewall.

---

## 7. Pipeline Reproducibility & The Manifest
- **The Manifest**: A cryptographic manifest records SHA-256 hashes of every input file, step configuration, and output shard.
- **Idempotency**: Ensures that running the pipeline on the same raw input always yields the exact same clean shards, making data engineering a reproducible science.
