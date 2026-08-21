# Course Assignments Overview

This file consolidates the assignments for Sessions 3, 4, 5, and 8 from the course materials found in the `sessions` directory.

---

## Session 3 Assignment: Sourcing & India-First 40B LLM

### Objective
Assume you have to train a **40B parameter model** that matches the capabilities of Gemma 4, specialized in coding, agentic work, and Indic languages, with an "India-first" perspective (viewing the world from an Indian viewpoint).

### Key Deliverables & Decisions
1. **Data Sourcing & Collection**:
   - Define what your data mixture looks like.
   - Specify what data you would collect and why for each stage:
     - Pre-training
     - Post-training (SFT)
     - RL / Alignment
2. **Data Cleaning**:
   - Detail the cleaning strategies tailored for the India-first objective.
3. **Evaluation Protocol**:
   - Outline how you would test and benchmark the model against these objectives.
4. **Language & Task Focus**:
   - Target focus languages and their fertility bounds.
   - Establish targets for coding, science, math, and agentic tasks.
   - Define your final tokenizer size (token vocabulary size) based on these targets.
5. **Submission**:
   - Compile findings into a concise, detailed report.
   - Host on Netlify/Vercel and share the link.

---

## Session 4 Assignment: Data Cleaning & Deduplication Widget

### Objective
Explore data cleaning strategies and apply them to a dataset.

### Key Deliverables & Decisions
1. **Deduplication & Cleaning Strategies**:
   - Identify and describe the total number of strategies listed in Session 4.
2. **Dataset Application**:
   - Pick a 10-100M token dataset (e.g. from Session 3 corpus candidates).
   - Apply the cleanups (normalization, format discipline, quality filtering, deduplication, language validation, PII removal, decontamination).
3. **Interactive Widget**:
   - Create an interactive widget explaining:
     - The strategies and descriptions.
     - The chosen dataset.
     - What was cleaned, why, and how.
     - Additional custom strategies or concerns handled.
     - Final dataset statistics before and after cleanups.
4. **Submission**:
   - Deploy the widget/report page to Netlify/Vercel and share the link.

---

## Session 5 Assignment: Data Mixtures & Curriculum Specification

### Objective
Draft the **mixture-and-curriculum specification** for the V5 model training run.

### Key Deliverables & Decisions
1. **Budget Shares**:
   - State the explicit budget allocation for every capability slot.
2. **Indic Language Slot Split**:
   - Split the Indic slot across verified, unverified, translated, and synthetic tiers.
3. **Specialized Slots**:
   - Define agentic, reasoning, and long-context slots, pointing each to specific inventory datasets.
4. **Training Controls**:
   - Establish the protected always-on floor for the selector.
   - Declare the cooldown anneal reserve held back for the final phase.
5. **Curriculum Design**:
   - Layout the difficulty and reasoning-length bands with concrete examples.
6. **Validation**:
   - Propose proxy runs (1B and 3B scale) to validate the hyperparameter and mixture choices before scaling up to full training.
7. **Submission**:
   - Compile into a written specification, deploy, and share.

---

## Session 8 Assignment: Attention Timeline Explainer

### Objective
Build an interactive, chronological web app explaining the evolution of attention and positional encoding mechanisms covered in the course.

### Key Deliverables & Decisions
1. **Chronological Order**:
   - Present attention mechanisms by their actual arXiv preprint release dates.
2. **The Narrative Arc**:
   - Tell the story of how the field went from exactness to memory-efficiency, to length extension, and back to memory savings.
3. **Balanced Trade-Offs**:
   - Highlight the "What it buys" vs "What it costs" for each technique (the structure vs parameters trade-off).
4. **Required Coverage**:
   - Standard attention, absolute learned positions, sinusoidal, RoPE, ALiBi, MQA, GQA, sliding window, attention sinks, NTK-aware scaling, YaRN, linear attention, the delta rule, Gated DeltaNet, MLA, sparse/top-k attention, DeepSeek CSA, and DroPE.
5. **Interactive Visualization**:
   - Visual diagrams explaining how each works.
   - Side-by-side comparison tool.
6. **Submission**:
   - Share live link + GitHub repository with verified sources for all dates in the README.
