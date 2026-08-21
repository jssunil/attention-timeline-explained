/**
 * Diagrams Component
 * Creates SVG-based visual diagrams for each mechanism type.
 */

export function createDiagram(mechanism, container) {
  const diagramFn = DIAGRAM_MAP[mechanism.id];
  if (!diagramFn) {
    container.style.display = 'none';
    return;
  }
  container.innerHTML = '';
  const svg = diagramFn(mechanism);
  container.appendChild(svg);
}

// ── SVG Helper ────────────────────────────────────────────────────
function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  children.forEach((child) => {
    if (typeof child === 'string') {
      el.textContent = child;
    } else if (child) {
      el.appendChild(child);
    }
  });
  return el;
}

function createSVG(width, height, viewBox) {
  return svgEl('svg', {
    width: '100%',
    height: 'auto',
    viewBox: viewBox || `0 0 ${width} ${height}`,
    xmlns: 'http://www.w3.org/2000/svg',
  });
}

// ── Attention Matrix Heatmap ──────────────────────────────────────
function diagramAttentionMatrix() {
  const size = 6;
  const cell = 36;
  const pad = 60;
  const w = pad + size * cell + 20;
  const h = pad + size * cell + 40;
  const svg = createSVG(w, h);

  // Title
  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['Attention Weight Matrix (Causal Mask)']));

  // Labels
  const tokens = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
  tokens.forEach((t, i) => {
    // Row labels (Query)
    svg.appendChild(svgEl('text', {
      x: pad - 8, y: pad + i * cell + cell / 2 + 4,
      fill: '#6868a0', 'font-size': '10', 'text-anchor': 'end',
      'font-family': 'JetBrains Mono, monospace'
    }, [t]));
    // Column labels (Key)
    svg.appendChild(svgEl('text', {
      x: pad + i * cell + cell / 2, y: pad - 8,
      fill: '#6868a0', 'font-size': '10', 'text-anchor': 'middle',
      'font-family': 'JetBrains Mono, monospace'
    }, [t]));
  });

  // Axis labels
  svg.appendChild(svgEl('text', {
    x: pad - 8, y: pad - 22,
    fill: '#4ade80', 'font-size': '9', 'text-anchor': 'end',
    'font-family': 'Inter, sans-serif', 'font-weight': '600'
  }, ['Query ↓']));
  svg.appendChild(svgEl('text', {
    x: pad + size * cell / 2, y: pad - 22,
    fill: '#22d3ee', 'font-size': '9', 'text-anchor': 'middle',
    'font-family': 'Inter, sans-serif', 'font-weight': '600'
  }, ['Key →']));

  // Cells
  for (let q = 0; q < size; q++) {
    for (let k = 0; k < size; k++) {
      const isCausal = k <= q;
      // Attention weights decrease with distance (simplified)
      const dist = q - k;
      const weight = isCausal ? Math.max(0.08, 1 / (1 + dist * 0.6)) : 0;
      const opacity = isCausal ? weight : 0.02;
      const color = isCausal
        ? `rgba(129, 140, 248, ${opacity})`
        : 'rgba(255, 255, 255, 0.02)';

      svg.appendChild(svgEl('rect', {
        x: pad + k * cell + 1,
        y: pad + q * cell + 1,
        width: cell - 2,
        height: cell - 2,
        rx: 3,
        fill: color,
        stroke: 'rgba(255,255,255,0.06)',
        'stroke-width': '1',
      }));

      if (isCausal) {
        svg.appendChild(svgEl('text', {
          x: pad + k * cell + cell / 2,
          y: pad + q * cell + cell / 2 + 4,
          fill: weight > 0.4 ? '#e8e8f0' : '#6868a0',
          'font-size': '9',
          'text-anchor': 'middle',
          'font-family': 'JetBrains Mono, monospace'
        }, [weight.toFixed(2)]));
      } else {
        svg.appendChild(svgEl('text', {
          x: pad + k * cell + cell / 2,
          y: pad + q * cell + cell / 2 + 4,
          fill: '#3a3a5a',
          'font-size': '8',
          'text-anchor': 'middle',
          'font-family': 'JetBrains Mono, monospace'
        }, ['-∞']));
      }
    }
  }

  // Legend
  svg.appendChild(svgEl('text', {
    x: pad, y: pad + size * cell + 24,
    fill: '#6868a0', 'font-size': '9',
    'font-family': 'Inter, sans-serif'
  }, ['Causal mask: each token can only attend to itself and earlier tokens. Darker = higher weight.']));

  return svg;
}

// ── KV Cache Comparison ───────────────────────────────────────────
function diagramKVCache() {
  const w = 480;
  const h = 220;
  const svg = createSVG(w, h);

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['KV Cache Size: MHA vs GQA vs MQA']));

  const configs = [
    { label: 'MHA (8 KV heads)', heads: 8, color: '#818cf8' },
    { label: 'GQA (2 KV heads)', heads: 2, color: '#22d3ee' },
    { label: 'MQA (1 KV head)', heads: 1, color: '#fbbf24' },
  ];

  const maxHeads = 8;
  const barW = 100;
  const barMaxH = 120;
  const startX = 60;
  const baseY = 170;
  const gap = 40;

  configs.forEach((cfg, i) => {
    const x = startX + i * (barW + gap);
    const barH = (cfg.heads / maxHeads) * barMaxH;

    // Bar
    const grad = svgEl('linearGradient', { id: `kv-grad-${i}`, x1: '0', y1: '0', x2: '0', y2: '1' }, [
      svgEl('stop', { offset: '0%', 'stop-color': cfg.color, 'stop-opacity': '0.8' }),
      svgEl('stop', { offset: '100%', 'stop-color': cfg.color, 'stop-opacity': '0.3' }),
    ]);
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = svgEl('defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.appendChild(grad);

    svg.appendChild(svgEl('rect', {
      x, y: baseY - barH, width: barW, height: barH,
      rx: 6, fill: `url(#kv-grad-${i})`,
      stroke: cfg.color, 'stroke-width': '1', 'stroke-opacity': '0.4',
    }));

    // Value on bar
    svg.appendChild(svgEl('text', {
      x: x + barW / 2, y: baseY - barH - 8,
      fill: cfg.color, 'font-size': '11', 'font-weight': '600',
      'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace'
    }, [`${cfg.heads} heads`]));

    // Label below
    svg.appendChild(svgEl('text', {
      x: x + barW / 2, y: baseY + 16,
      fill: '#9898b8', 'font-size': '10', 'text-anchor': 'middle',
      'font-family': 'Inter, sans-serif'
    }, [cfg.label]));

    // Cache size (relative)
    const pct = Math.round((cfg.heads / maxHeads) * 100);
    svg.appendChild(svgEl('text', {
      x: x + barW / 2, y: baseY + 30,
      fill: '#6868a0', 'font-size': '9', 'text-anchor': 'middle',
      'font-family': 'Inter, sans-serif'
    }, [`${pct}% cache`]));
  });

  return svg;
}

// ── Sliding Window Pattern ────────────────────────────────────────
function diagramSlidingWindow() {
  const size = 8;
  const cell = 32;
  const windowSize = 3;
  const pad = 50;
  const w = pad + size * cell + 20;
  const h = pad + size * cell + 40;
  const svg = createSVG(w, h);

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['Sliding Window Attention Pattern (w=3)']));

  for (let q = 0; q < size; q++) {
    for (let k = 0; k < size; k++) {
      const inWindow = k <= q && k >= q - windowSize + 1;
      const color = inWindow
        ? 'rgba(167, 139, 250, 0.5)'
        : 'rgba(255, 255, 255, 0.02)';

      svg.appendChild(svgEl('rect', {
        x: pad + k * cell + 1,
        y: pad + q * cell + 1,
        width: cell - 2,
        height: cell - 2,
        rx: 2,
        fill: color,
        stroke: 'rgba(255,255,255,0.04)',
        'stroke-width': '1',
      }));
    }

    // Row label
    svg.appendChild(svgEl('text', {
      x: pad - 6, y: pad + q * cell + cell / 2 + 4,
      fill: '#6868a0', 'font-size': '9', 'text-anchor': 'end',
      'font-family': 'JetBrains Mono, monospace'
    }, [`t${q}`]));
    // Col label
    svg.appendChild(svgEl('text', {
      x: pad + q * cell + cell / 2, y: pad - 6,
      fill: '#6868a0', 'font-size': '9', 'text-anchor': 'middle',
      'font-family': 'JetBrains Mono, monospace'
    }, [`t${q}`]));
  }

  svg.appendChild(svgEl('text', {
    x: pad, y: pad + size * cell + 20,
    fill: '#6868a0', 'font-size': '9',
    'font-family': 'Inter, sans-serif'
  }, ['Each token attends only to w=3 nearest tokens. O(T×w) instead of O(T²).']));

  return svg;
}

// ── RoPE Rotation ─────────────────────────────────────────────────
function diagramRoPE() {
  const w = 440;
  const h = 220;
  const svg = createSVG(w, h);
  const cx = 140;
  const cy = 120;
  const r = 70;

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['RoPE: Position as Rotation']));

  // Circle
  svg.appendChild(svgEl('circle', {
    cx, cy, r, fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': '1',
  }));

  // Arrows at different angles
  const positions = [
    { pos: 0, angle: 0, color: '#818cf8', label: 'pos 0' },
    { pos: 1, angle: 45, color: '#a78bfa', label: 'pos 1' },
    { pos: 2, angle: 90, color: '#22d3ee', label: 'pos 2' },
    { pos: 3, angle: 135, color: '#fbbf24', label: 'pos 3' },
  ];

  positions.forEach(({ angle, color, label }) => {
    const rad = (angle * Math.PI) / 180;
    const x2 = cx + r * Math.cos(-rad);
    const y2 = cy + r * Math.sin(-rad);

    svg.appendChild(svgEl('line', {
      x1: cx, y1: cy, x2, y2,
      stroke: color, 'stroke-width': '2', 'stroke-opacity': '0.8',
    }));

    svg.appendChild(svgEl('circle', {
      cx: x2, cy: y2, r: 4, fill: color,
    }));

    svg.appendChild(svgEl('text', {
      x: x2 + (Math.cos(-rad) > 0 ? 10 : -10),
      y: y2 + (Math.sin(-rad) > 0 ? -8 : 14),
      fill: color, 'font-size': '10', 'text-anchor': Math.cos(-rad) > 0 ? 'start' : 'end',
      'font-family': 'JetBrains Mono, monospace'
    }, [label]));
  });

  // Explanation
  const textX = 280;
  const lines = [
    { text: 'Each position rotates Q and K', y: 60 },
    { text: 'by θ × position index.', y: 76 },
    { text: '', y: 92 },
    { text: 'When Q·K is computed,', y: 108 },
    { text: 'only the RELATIVE rotation', y: 124 },
    { text: '(i − j) matters.', y: 140 },
    { text: '', y: 156 },
    { text: 'Score depends on distance,', y: 172 },
    { text: 'not absolute position.', y: 188 },
  ];

  lines.forEach(({ text, y }) => {
    svg.appendChild(svgEl('text', {
      x: textX, y, fill: '#9898b8', 'font-size': '10',
      'font-family': 'Inter, sans-serif'
    }, [text]));
  });

  return svg;
}

// ── Linear Attention State ────────────────────────────────────────
function diagramLinearAttention() {
  const w = 480;
  const h = 180;
  const svg = createSVG(w, h);

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['Linear Attention: Fixed-Size Running State']));

  const steps = [
    { x: 30, label: 'S₀ = 0', desc: 'Empty state' },
    { x: 130, label: 'S₁ = k₁v₁ᵀ', desc: 'First token' },
    { x: 250, label: 'S₂ = S₁ + k₂v₂ᵀ', desc: 'Accumulate' },
    { x: 380, label: 'S₃ = S₂ + k₃v₃ᵀ', desc: 'Accumulate' },
  ];

  const y = 80;
  const boxH = 50;
  const boxW = 90;

  steps.forEach((step, i) => {
    // Box
    svg.appendChild(svgEl('rect', {
      x: step.x, y: y, width: boxW, height: boxH,
      rx: 6, fill: 'rgba(167, 139, 250, 0.1)',
      stroke: '#a78bfa', 'stroke-width': '1', 'stroke-opacity': '0.4',
    }));

    // Label
    svg.appendChild(svgEl('text', {
      x: step.x + boxW / 2, y: y + 22,
      fill: '#a78bfa', 'font-size': '10', 'font-weight': '500',
      'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace'
    }, [step.label]));

    // Description
    svg.appendChild(svgEl('text', {
      x: step.x + boxW / 2, y: y + 38,
      fill: '#6868a0', 'font-size': '9', 'text-anchor': 'middle',
      'font-family': 'Inter, sans-serif'
    }, [step.desc]));

    // Arrow
    if (i < steps.length - 1) {
      const nextX = steps[i + 1].x;
      svg.appendChild(svgEl('line', {
        x1: step.x + boxW, y1: y + boxH / 2,
        x2: nextX, y2: y + boxH / 2,
        stroke: '#6868a0', 'stroke-width': '1',
        'marker-end': 'url(#arrowhead)',
      }));
    }
  });

  // Arrowhead marker
  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'arrowhead', markerWidth: '8', markerHeight: '6',
    refX: '8', refY: '3', orient: 'auto',
  });
  marker.appendChild(svgEl('polygon', {
    points: '0 0, 8 3, 0 6', fill: '#6868a0',
  }));
  defs.appendChild(marker);
  svg.insertBefore(defs, svg.firstChild);

  // Caption
  svg.appendChild(svgEl('text', {
    x: w / 2, y: 160,
    fill: '#6868a0', 'font-size': '9', 'text-anchor': 'middle',
    'font-family': 'Inter, sans-serif'
  }, ['State S has fixed size — doesn\'t grow with context. But old info can\'t be corrected.']));

  return svg;
}

// ── Delta Rule Correction ─────────────────────────────────────────
function diagramDeltaRule() {
  const w = 480;
  const h = 200;
  const svg = createSVG(w, h);

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['Delta Rule: Self-Correcting State Updates']));

  // Flow diagram
  const boxes = [
    { x: 20, y: 60, w: 80, h: 44, label: 'State Sₜ₋₁', color: '#a78bfa' },
    { x: 130, y: 60, w: 80, h: 44, label: 'Read: Sₜ₋₁·kₜ', color: '#818cf8' },
    { x: 240, y: 60, w: 90, h: 44, label: 'Error: vₜ - Sₜ₋₁·kₜ', color: '#f87171' },
    { x: 360, y: 60, w: 100, h: 44, label: 'Write: β(error)·kₜᵀ', color: '#4ade80' },
  ];

  boxes.forEach((box) => {
    svg.appendChild(svgEl('rect', {
      x: box.x, y: box.y, width: box.w, height: box.h,
      rx: 6, fill: `${box.color}10`,
      stroke: box.color, 'stroke-width': '1', 'stroke-opacity': '0.4',
    }));

    // Split label into lines if needed
    const lines = box.label.split(': ');
    if (lines.length === 2) {
      svg.appendChild(svgEl('text', {
        x: box.x + box.w / 2, y: box.y + 18,
        fill: '#6868a0', 'font-size': '8',
        'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
      }, [lines[0]]));
      svg.appendChild(svgEl('text', {
        x: box.x + box.w / 2, y: box.y + 32,
        fill: box.color, 'font-size': '9', 'font-weight': '500',
        'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace'
      }, [lines[1]]));
    } else {
      svg.appendChild(svgEl('text', {
        x: box.x + box.w / 2, y: box.y + box.h / 2 + 4,
        fill: box.color, 'font-size': '9', 'font-weight': '500',
        'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace'
      }, [box.label]));
    }
  });

  // Arrows between boxes
  for (let i = 0; i < boxes.length - 1; i++) {
    svg.appendChild(svgEl('line', {
      x1: boxes[i].x + boxes[i].w,
      y1: boxes[i].y + boxes[i].h / 2,
      x2: boxes[i + 1].x,
      y2: boxes[i + 1].y + boxes[i + 1].h / 2,
      stroke: '#6868a0', 'stroke-width': '1',
    }));
  }

  // Key difference callout
  const calloutY = 130;
  svg.appendChild(svgEl('rect', {
    x: 40, y: calloutY, width: 400, height: 50,
    rx: 8, fill: 'rgba(251, 191, 36, 0.04)',
    stroke: 'rgba(251, 191, 36, 0.2)', 'stroke-width': '1',
  }));
  svg.appendChild(svgEl('text', {
    x: 240, y: calloutY + 20,
    fill: '#fbbf24', 'font-size': '10', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['Key: Don\'t just add v — compute the CORRECTION from what\'s already stored.']));
  svg.appendChild(svgEl('text', {
    x: 240, y: calloutY + 36,
    fill: '#9898b8', 'font-size': '9',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['This makes the state self-correcting — old info can be overwritten.']));

  return svg;
}

// ── Position Family Map ───────────────────────────────────────────
function diagramPositionFamily() {
  const w = 480;
  const h = 160;
  const svg = createSVG(w, h);

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['Position Encoding Evolution (Session 7)']));

  const items = [
    { x: 10, label: 'Absolute\nLearned', sub: 'Hard wall', color: '#818cf8' },
    { x: 130, label: 'Sinusoidal', sub: 'Defined everywhere', color: '#a78bfa' },
    { x: 250, label: 'RoPE', sub: 'Graceful decay', color: '#22d3ee' },
    { x: 370, label: 'ALiBi', sub: 'Extrapolates', color: '#fbbf24' },
  ];

  const y = 60;
  const boxW = 90;
  const boxH = 55;

  items.forEach((item, i) => {
    svg.appendChild(svgEl('rect', {
      x: item.x, y, width: boxW, height: boxH,
      rx: 8, fill: `${item.color}10`,
      stroke: item.color, 'stroke-width': '1', 'stroke-opacity': '0.4',
    }));

    const lines = item.label.split('\n');
    lines.forEach((line, li) => {
      svg.appendChild(svgEl('text', {
        x: item.x + boxW / 2, y: y + 20 + li * 14,
        fill: item.color, 'font-size': '10', 'font-weight': '600',
        'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
      }, [line]));
    });

    svg.appendChild(svgEl('text', {
      x: item.x + boxW / 2, y: y + boxH + 14,
      fill: '#6868a0', 'font-size': '8', 'text-anchor': 'middle',
      'font-family': 'Inter, sans-serif'
    }, [item.sub]));

    // Arrow
    if (i < items.length - 1) {
      svg.appendChild(svgEl('line', {
        x1: item.x + boxW + 2, y1: y + boxH / 2,
        x2: items[i + 1].x - 2, y2: y + boxH / 2,
        stroke: '#6868a0', 'stroke-width': '1', 'stroke-dasharray': '4,3',
      }));
    }
  });

  // Bottom label
  svg.appendChild(svgEl('text', {
    x: w / 2, y: 148,
    fill: '#6868a0', 'font-size': '9', 'text-anchor': 'middle',
    'font-family': 'Inter, sans-serif', 'font-style': 'italic'
  }, ['Each step: more structure, fewer stored parameters → better generalization, less expressiveness']));

  return svg;
}

// ── Attention Sinks Diagram ───────────────────────────────────────
function diagramAttentionSinks() {
  const w = 480;
  const h = 140;
  const svg = createSVG(w, h);

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['Attention Sinks + Sliding Window = Streaming']));

  const y = 50;
  const tokenW = 28;
  const numTokens = 14;
  const sinkCount = 2;
  const windowSize = 4;

  for (let i = 0; i < numTokens; i++) {
    const isSink = i < sinkCount;
    const isWindow = i >= numTokens - windowSize;
    const isEvicted = !isSink && !isWindow;

    let color, opacity;
    if (isSink) {
      color = '#fbbf24';
      opacity = 0.6;
    } else if (isWindow) {
      color = '#22d3ee';
      opacity = 0.5;
    } else {
      color = '#ffffff';
      opacity = 0.04;
    }

    svg.appendChild(svgEl('rect', {
      x: 30 + i * (tokenW + 3), y,
      width: tokenW, height: 40,
      rx: 4, fill: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      stroke: isEvicted ? 'rgba(255,255,255,0.04)' : color,
      'stroke-width': '1', 'stroke-opacity': isEvicted ? '1' : '0.4',
    }));

    svg.appendChild(svgEl('text', {
      x: 30 + i * (tokenW + 3) + tokenW / 2, y: y + 24,
      fill: isEvicted ? '#3a3a5a' : color,
      'font-size': '8', 'text-anchor': 'middle',
      'font-family': 'JetBrains Mono, monospace'
    }, [`t${i}`]));
  }

  // Labels
  svg.appendChild(svgEl('text', {
    x: 30 + tokenW, y: y - 8,
    fill: '#fbbf24', 'font-size': '9', 'text-anchor': 'middle',
    'font-family': 'Inter, sans-serif', 'font-weight': '600'
  }, ['Sinks']));
  svg.appendChild(svgEl('text', {
    x: 30 + (numTokens - windowSize / 2) * (tokenW + 3), y: y - 8,
    fill: '#22d3ee', 'font-size': '9', 'text-anchor': 'middle',
    'font-family': 'Inter, sans-serif', 'font-weight': '600'
  }, ['Window']));

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 125,
    fill: '#6868a0', 'font-size': '9', 'text-anchor': 'middle',
    'font-family': 'Inter, sans-serif'
  }, ['Keep first ~4 "sink" tokens + recent window. Evicted tokens (grey) are gone.']));

  return svg;
}

// ── Sparse/CSA Diagram ────────────────────────────────────────────
function diagramCSA() {
  const w = 480;
  const h = 180;
  const svg = createSVG(w, h);

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 18, fill: '#9898b8', 'font-size': '12', 'font-weight': '600',
    'text-anchor': 'middle', 'font-family': 'Inter, sans-serif'
  }, ['DeepSeek CSA: Compress → Select → Attend']));

  const stages = [
    { x: 20, label: 'T tokens', w: 70, color: '#818cf8' },
    { x: 120, label: 'T/b blocks\n(compress)', w: 85, color: '#a78bfa' },
    { x: 240, label: 'top-k blocks\n(select)', w: 85, color: '#22d3ee' },
    { x: 360, label: 'Attend\n(k×b tokens)', w: 90, color: '#fbbf24' },
  ];

  const y = 55;
  const boxH = 65;

  stages.forEach((stage, i) => {
    svg.appendChild(svgEl('rect', {
      x: stage.x, y, width: stage.w, height: boxH,
      rx: 8, fill: `${stage.color}10`,
      stroke: stage.color, 'stroke-width': '1', 'stroke-opacity': '0.4',
    }));

    const lines = stage.label.split('\n');
    lines.forEach((line, li) => {
      svg.appendChild(svgEl('text', {
        x: stage.x + stage.w / 2, y: y + 25 + li * 15,
        fill: lines.length > 1 && li === 1 ? '#6868a0' : stage.color,
        'font-size': li === 0 ? '10' : '9', 'font-weight': li === 0 ? '600' : '400',
        'text-anchor': 'middle',
        'font-family': li === 0 ? 'JetBrains Mono, monospace' : 'Inter, sans-serif'
      }, [line]));
    });

    if (i < stages.length - 1) {
      svg.appendChild(svgEl('text', {
        x: stage.x + stage.w + (stages[i + 1].x - stage.x - stage.w) / 2,
        y: y + boxH / 2 + 4,
        fill: '#6868a0', 'font-size': '14', 'text-anchor': 'middle',
      }, ['→']));
    }
  });

  svg.appendChild(svgEl('text', {
    x: w / 2, y: 155,
    fill: '#6868a0', 'font-size': '9', 'text-anchor': 'middle',
    'font-family': 'Inter, sans-serif'
  }, ['Two separate savings: fewer positions stored (compression) AND fewer positions read (top-k).']));

  return svg;
}

// ── Diagram Map ───────────────────────────────────────────────────
const DIAGRAM_MAP = {
  'scaled-dot-product': diagramAttentionMatrix,
  'sinusoidal': diagramPositionFamily,
  'absolute-learned': diagramPositionFamily,
  'mqa': diagramKVCache,
  'sliding-window': diagramSlidingWindow,
  'linear-attention': diagramLinearAttention,
  'delta-rule': diagramDeltaRule,
  'rope': diagramRoPE,
  'alibi': diagramPositionFamily,
  'gqa': diagramKVCache,
  'attention-sinks': diagramAttentionSinks,
  'mla': diagramKVCache,
  'gated-deltanet': diagramDeltaRule,
  'deepseek-csa': diagramCSA,
};
