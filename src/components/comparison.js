/**
 * Comparison Component
 * Side-by-side comparison of selected mechanisms.
 */

export function initComparison(mechanisms, state, ERA_COLORS) {
  const btn = document.getElementById('compare-btn');
  const panel = document.getElementById('comparison-panel');
  const closeBtn = document.getElementById('close-comparison');
  const body = document.getElementById('comparison-body');

  if (!btn || !panel || !closeBtn || !body) return;

  btn.addEventListener('click', () => {
    renderComparison(mechanisms, state, ERA_COLORS, body);
    panel.classList.add('comparison-panel--open');
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('comparison-panel--open');
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      panel.classList.remove('comparison-panel--open');
    }
  });
}

function renderComparison(mechanisms, state, ERA_COLORS, container) {
  container.innerHTML = '';
  const selected = Array.from(state.selectedForComparison)
    .map((id) => mechanisms.find((m) => m.id === id))
    .filter(Boolean)
    .slice(0, 2); // Max 2 for now

  if (selected.length < 2) {
    container.innerHTML = '<p style="color: var(--text-muted); padding: 2rem; grid-column: 1/-1; text-align: center;">Select exactly 2 mechanisms to compare.</p>';
    return;
  }

  const [a, b] = selected;

  const dimensions = [
    { label: 'Year', get: (m) => m.date },
    { label: 'Category', get: (m) => m.category },
    { label: 'Problem It Solved', get: (m) => m.problemItSolved },
    { label: 'How It Works', get: (m) => m.howItWorks },
    { label: 'Pros', get: (m) => `<ul>${m.pros.map((p) => `<li>${p}</li>`).join('')}</ul>` },
    { label: 'Cons', get: (m) => `<ul>${m.cons.map((c) => `<li>${c}</li>`).join('')}</ul>` },
    { label: 'When To Use', get: (m) => m.whenToUse },
  ];

  const getEra = (m) => {
    const eraKey = m.era;
    return ERA_COLORS[eraKey] || ERA_COLORS.foundation;
  };

  // Header row
  const headerHtml = `
    <div class="comparison-card" style="--card-accent: ${getEra(a).accent}">
      <h3 class="comparison-card__name">${a.name}</h3>
      <p class="comparison-card__date">${a.date} · ${a.paper}</p>
    </div>
    <div class="comparison-card" style="--card-accent: ${getEra(b).accent}">
      <h3 class="comparison-card__name">${b.name}</h3>
      <p class="comparison-card__date">${b.date} · ${b.paper}</p>
    </div>
  `;

  // Dimension rows
  const rowsHtml = dimensions
    .map(
      (dim) => `
    <div class="comparison-row">
      <p class="comparison-row__label">${dim.label}</p>
      <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.7;">${dim.get(a)}</div>
      <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.7;">${dim.get(b)}</div>
    </div>
  `
    )
    .join('');

  container.innerHTML = headerHtml + rowsHtml;
}
