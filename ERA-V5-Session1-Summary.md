# Session 1: From Neural Networks to the Transformer
**Detailed session summary** · 2 July 2026 · 180 minutes · ~50 participants

*Sources: the live session transcript, and the official lesson page "Session 1: From Neural Networks to the Transformer" (Axiom, 14 sections).*

---

## The one sentence

> **Transformers succeed because they replace sequential recurrence with parallel dot-product lookup.**

This session traces the full path from the simplest mathematical neuron to the modern Transformer block. It explains why classical sequential architectures (RNNs/LSTMs) hit a scaling wall and how self-attention resolves this bottleneck through parallel, query-key-value vector lookups.

---

## 1. The Single Neuron & Representation Learning
The single neuron is the fundamental atomic building block of all deep learning architectures:
- **Inputs & Projections**: It takes a vector of inputs $x$, projects them using a weight vector $w$, adds a bias scalar $b$, and computes a pre-activation value $z = w^T x + b$.
- **Activation Functions**: An activation function (historically Sigmoid/Tanh, now ReLU, GeLU, or SwiGLU) introduces non-linearity, allowing the model to approximate complex, non-linear functions instead of just linear ones.
- **Layers to Networks**: Multi-layer perceptrons (MLPs) stack these units into hidden layers. Each layer learns to represent the input features at a higher level of abstraction, moving from raw values to semantic representations.

---

## 2. Gradient Descent & Backpropagation
How neural networks learn from errors:
- **Loss Function**: Measures the distance between the network's prediction and the target (e.g. Cross-Entropy for language generation, Mean Squared Error for regression).
- **Backpropagation**: Uses the chain rule of calculus to compute the gradient of the loss function with respect to every weight and bias in the network.
- **Gradient Descent & Optimizers**: Optimizers (such as AdamW) adjust the weights in the opposite direction of the gradient:
  $$w \leftarrow w - \eta \cdot \frac{\partial L}{\partial w}$$
  where $\eta$ is the learning rate.

---

## 3. The Language Modeling Seam: Words as Vectors
- **One-Hot Encoding**: A naive approach of representing words as sparse vectors of vocabulary size $V$ fails to capture any similarity (every word is orthogonal to every other word).
- **Word Embeddings (Word2Vec)**: Maps discrete tokens into a low-dimensional continuous vector space ($D$-dimensional space). The distance between vectors in this space represents semantic similarity (e.g., "king - man + woman = queen").

---

## 4. The Sequential Wall: RNNs & LSTMs
Before the Transformer, Recurrent Neural Networks (RNNs) and Long Short-Term Memory (LSTM) networks were the standard for language tasks:
- **Sequential Bottleneck**: RNNs process tokens one by one, keeping a hidden state vector $h_t$ that carries past context:
  $$h_t = \tanh(W_{hh} h_{t-1} + W_{xh} x_t)$$
- **Vanishing/Exploding Gradients**: During backpropagation over long sequences, gradients are multiplied repeatedly by the weight matrix $W_{hh}$, causing them to either decay to zero (vanishing) or blow up to infinity (exploding).
- **Hardware Inefficiency**: Sequential computation cannot be parallelized over GPU cores, making training on large web-scale corpora impossible.

---

## 5. Self-Attention: The QKV Lookup
Self-attention solves the sequential bottleneck by letting every token attend to every other token simultaneously:
- **Projections**: For each token, three projection matrices ($W_Q, W_K, W_V$) produce three vectors:
  - **Query ($Q$)**: "What am I looking for?"
  - **Key ($K$)**: "What do I represent?"
  - **Value ($V$)**: "What information do I carry?"
- **Scaled Dot-Product Formula**:
  $$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{Q K^T}{\sqrt{d_k}}\right) V$$
  - The dot product $Q K^T$ measures pairwise similarity.
  - The scaling factor $1 / \sqrt{d_k}$ prevents the dot products from growing too large in high dimensions, which would saturate the softmax and cause vanishing gradients during backpropagation.
  - Softmax normalizes the similarity scores into an attention weight distribution (summing to 1).

---

## 6. The Complete Transformer Block
The modern Transformer block stacks self-attention and feed-forward operations, surrounded by structural components:
- **Multi-Head Attention (MHA)**: Runs several attention projections in parallel, letting the model focus on different aspects of context simultaneously (e.g. syntax, grammar, and coreference).
- **Residual Streams (Skip Connections)**: Adds the input of a layer back to its output:
  $$x \leftarrow x + \text{Layer}(x)$$
  This provides an unimpeded highway for gradients during backpropagation, solving the vanishing gradient problem at depth.
- **Layer Normalization (LayerNorm)**: Normalizes activations across the channel dimension to stabilize training dynamics.
- **Feed-Forward Network (FFN)**: Applies a two-layer MLP to each token position independently, introducing capacity and non-linear transformations.

---

## 7. Scaling to Frontier LLMs
The architecture is scaled through pretraining, instruction tuning, and alignment:
- **Autoregressive Pretraining**: Next-token prediction on massive corpora teaches the model general grammar, logic, and factual knowledge.
- **Instruction Tuning (SFT)**: Fine-tunes the pretrained model on instruction-response pairs to align it with user intent.
- **Alignment (RLHF/DPO)**: Optimizes the output generation based on human preference feedback to ensure helpfulness and safety.
