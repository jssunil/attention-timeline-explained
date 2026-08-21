# How to Read the Attention Timeline

This timeline is designed to tell a **story**. Rather than presenting attention mechanisms as a flat list, it lays them out in the order they were launched chronologically. 

When you read the timeline from left to right, you are watching the research community dynamically react to computational and memory constraints over time.

---

## 1. The Core Narrative Arc
Every mechanism in this timeline was introduced as a response to a specific bottleneck that existed at that exact moment. You can trace this through four distinct eras:

```
┌─────────────────────────────────┐
│     Era 1: The Foundation       │  ──► Goal: Establish exact, parallelizable lookup
│          (2017 - 2019)          │      Bottleneck: Quadratic compute O(T²) & KV cache memory.
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│   Era 2: Efficiency & Position  │  ──► Goal: Compute positions instead of storing them;
│          (2020 - 2021)          │            explore linear state compression.
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│      Era 3: Scaling Up          │  ──► Goal: Handle 100K+ context lengths in production
│          (2022 - 2023)          │            by grouping keys and keeping attention sinks.
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│      Era 4: The Frontier        │  ──► Goal: Balance quality, context length, and memory
│          (2024 - 2026)          │            simultaneously (latent compression & hybrid layers).
└─────────────────────────────────┘
```

---

## 2. The Recurring Trade-Off
Keep this fundamental design law in mind as you explore the timeline:
> **Substituting structure for stored parameters buys generalization and costs expressiveness.**

- **Stored parameters** (like absolute learned positions) are highly expressive within a fixed range but fail instantly at unseen lengths.
- **Structured functions** (like RoPE, ALiBi, or Gated DeltaNet) restrict the model's capacity to represent certain arbitrary patterns but generalize seamlessly to longer sequence lengths.

---

## 3. How to Use the Interface
For each mechanism on the timeline, you will see a detailed detail card. Here is how to digest the information:

1. **The Launch Date**: Verified directly against arXiv submissions to place the paper in its exact historical context.
2. **The Problem It Solved**: The specific cost or structural wall researchers were trying to bypass.
3. **What It Buys (✓) vs. What It Costs (✗)**: Honest, balanced trade-offs. If a technique is presented with only pros, it is not fully understood yet. Every choice is a trade.
4. **When to Pick This**: Pragmatic guidance on when to choose this architecture (e.g. some are ideal for 2K context window serving, while others are required for 100K+ reasoning loops).
5. **Interactive SVG Diagrams**: Native inline animations showing:
   - *Attention Heatmaps*: Visualizing the causal mask.
   - *Bar Charts*: Showing KV Cache growth reduction (MHA vs GQA vs MQA).
   - *Flowcharts*: Showing Linear Attention updates and Delta Rule corrections.
   - *Circular projections*: Showing RoPE complex rotations.
6. **Side-by-Side Comparison**: Check the boxes on any two mechanisms to load a side-by-side comparison panel mapping their structural differences across multiple dimensions.
