/**
 * Cards Component
 * Renders mechanism detail cards grouped by era.
 */

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderCards(mechanisms, ERA_NARRATIVES, ERA_COLORS, state, helpers) {
  const container = document.getElementById('main-content');
  if (!container) return;

  const eraOrder = ['foundation', 'efficiency', 'scale', 'frontier'];
  const byEra = {};
  mechanisms.forEach((m) => {
    if (!byEra[m.era]) byEra[m.era] = [];
    byEra[m.era].push(m);
  });

  const fragment = document.createDocumentFragment();

  eraOrder.forEach((eraKey) => {
    const eraMechanisms = byEra[eraKey] || [];
    if (eraMechanisms.length === 0) return;

    const eraData = ERA_NARRATIVES[eraKey];
    const eraColor = ERA_COLORS[eraKey];

    // Era section
    const section = document.createElement('section');
    section.className = 'era-section';
    section.id = `era-${eraKey}`;

    // Era header
    const header = document.createElement('div');
    header.className = 'era-header';
    header.style.setProperty('--era-gradient', eraColor.gradient);
    header.style.setProperty('--era-bg', eraColor.bg);
    header.style.setProperty('--era-accent', eraColor.accent);

    header.innerHTML = `
      <p class="era-header__kicker">${eraData.years}</p>
      <h2 class="era-header__title">${eraData.title}</h2>
      <div class="era-header__story">${eraData.story}</div>
    `;
    section.appendChild(header);

    // Cards
    eraMechanisms.forEach((m) => {
      const card = createMechanismCard(m, eraColor, state, helpers, mechanisms);
      section.appendChild(card);
    });

    fragment.appendChild(section);
  });

  container.appendChild(fragment);
}

function createMechanismCard(m, eraColor, state, helpers, allMechanisms) {
  const card = document.createElement('article');
  card.className = `mechanism-card${m.isBonus ? ' mechanism-card--bonus' : ''}`;
  card.id = `card-${m.id}`;
  card.style.setProperty('--card-accent', eraColor.accent);

  // ── Header (always visible) ───────────────────────────────
  const headerEl = document.createElement('div');
  headerEl.className = 'card-header';

  headerEl.innerHTML = `
    <div class="card-header__date">
      <span class="card-header__year">${m.year}</span>
      <span class="card-header__month">${MONTHS[m.month] || ''}</span>
    </div>
    <div class="card-header__info">
      <h3 class="card-header__name">${m.name}</h3>
      <p class="card-header__paper">${m.paper} — ${m.authors}${m.arxiv ? ` (arXiv:${m.arxiv})` : ''}</p>
      <p class="card-header__problem">${m.problemItSolved}</p>
    </div>
    <input type="checkbox" class="card-header__compare-checkbox"
           title="Select for comparison" aria-label="Select ${m.shortName} for comparison"
           data-mechanism-id="${m.id}" />
    <div class="card-header__toggle">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 8l5 5 5-5"/>
      </svg>
    </div>
  `;

  // ── Body (expandable) ─────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'card-body';

  const inner = document.createElement('div');
  inner.className = 'card-body__inner';

  // How it works
  inner.innerHTML += `
    <div class="card-section">
      <h4 class="card-section__title">How It Works</h4>
      <p class="card-section__text">${m.howItWorks}</p>
      ${m.formula ? `<div class="card-formula">${escapeHtml(m.formula)}</div>` : ''}
    </div>
  `;

  // Diagram placeholder
  const diagramId = `diagram-${m.id}`;
  inner.innerHTML += `<div class="diagram-container" id="${diagramId}"></div>`;

  // Pros & Cons
  inner.innerHTML += `
    <div class="card-tradeoffs">
      <div class="card-tradeoffs__column card-tradeoffs__column--pros">
        <p class="card-tradeoffs__label card-tradeoffs__label--pros">✓ What it buys</p>
        <ul class="card-tradeoffs__list">
          ${m.pros.map((p) => `<li>${p}</li>`).join('')}
        </ul>
      </div>
      <div class="card-tradeoffs__column card-tradeoffs__column--cons">
        <p class="card-tradeoffs__label card-tradeoffs__label--cons">✗ What it costs</p>
        <ul class="card-tradeoffs__list">
          ${m.cons.map((c) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  // When to use
  inner.innerHTML += `
    <div class="card-when">
      <p class="card-when__label">When to pick this</p>
      <p>${m.whenToUse}</p>
    </div>
  `;

  // Key Insight
  if (m.keyInsight) {
    inner.innerHTML += `
      <div class="card-insight">
        <p>💡 ${m.keyInsight}</p>
      </div>
    `;
  }

  // Paper link
  if (m.arxiv) {
    inner.innerHTML += `
      <a class="card-paper-link" href="https://arxiv.org/abs/${m.arxiv}" target="_blank" rel="noopener noreferrer">
        📄 Read the paper on arXiv →
      </a>
    `;
  }

  // Related mechanisms
  if (m.relatedMechanisms && m.relatedMechanisms.length > 0) {
    const relatedDiv = document.createElement('div');
    relatedDiv.className = 'card-related';
    relatedDiv.innerHTML = m.relatedMechanisms
      .map((rid) => {
        const related = allMechanisms.find((x) => x.id === rid);
        if (!related) return '';
        return `<button class="card-related__tag" data-target="${rid}">${related.shortName}</button>`;
      })
      .join('');
    inner.appendChild(relatedDiv);
  }

  body.appendChild(inner);

  // ── Assemble ──────────────────────────────────────────────
  card.appendChild(headerEl);
  card.appendChild(body);

  // ── Events ────────────────────────────────────────────────
  // Toggle expand
  const toggleExpand = (e) => {
    // Don't toggle if clicking checkbox
    if (e.target.classList.contains('card-header__compare-checkbox')) return;

    const isExpanded = card.classList.contains('mechanism-card--expanded');
    if (isExpanded) {
      card.classList.remove('mechanism-card--expanded');
      state.expandedCards.delete(m.id);
    } else {
      card.classList.add('mechanism-card--expanded');
      state.expandedCards.add(m.id);
      // Render diagram on first expand
      const diagramEl = document.getElementById(diagramId);
      if (diagramEl && !diagramEl.dataset.rendered) {
        helpers.createDiagram(m, diagramEl);
        diagramEl.dataset.rendered = 'true';
      }
    }
  };
  headerEl.addEventListener('click', toggleExpand);

  // Comparison checkbox
  const checkbox = headerEl.querySelector('.card-header__compare-checkbox');
  checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      state.selectedForComparison.add(m.id);
    } else {
      state.selectedForComparison.delete(m.id);
    }
    updateCompareButton(state);
  });

  // Related mechanism links
  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('card-related__tag')) {
      const targetId = e.target.dataset.target;
      const targetCard = document.getElementById(`card-${targetId}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!targetCard.classList.contains('mechanism-card--expanded')) {
          targetCard.classList.add('mechanism-card--expanded');
          state.expandedCards.add(targetId);
        }
      }
    }
  });

  return card;
}

function updateCompareButton(state) {
  const btn = document.getElementById('compare-btn');
  const count = document.getElementById('compare-count');
  if (!btn || !count) return;

  const n = state.selectedForComparison.size;
  count.textContent = n;
  btn.style.display = n >= 2 ? 'block' : 'none';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
