/**
 * Timeline Component
 * Renders the sticky horizontal timeline navigation.
 */

export function renderTimeline(mechanisms, ERA_COLORS) {
  const track = document.getElementById('timeline-track');
  if (!track) return;

  // Group mechanisms by year
  const byYear = {};
  mechanisms.forEach((m) => {
    if (!byYear[m.year]) byYear[m.year] = [];
    byYear[m.year].push(m);
  });

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const eraForYear = (y) => {
    if (y <= 2019) return 'foundation';
    if (y <= 2021) return 'efficiency';
    if (y <= 2023) return 'scale';
    return 'frontier';
  };

  const fragment = document.createDocumentFragment();

  years.forEach((year, yi) => {
    const era = eraForYear(year);
    const color = ERA_COLORS[era].accent;

    // Year label
    const label = document.createElement('span');
    label.className = 'timeline-year-label';
    label.textContent = year;
    label.style.color = color;
    fragment.appendChild(label);

    // Dots for mechanisms in this year
    byYear[year].forEach((m, mi) => {
      if (mi > 0 || yi > 0) {
        // Segment between dots
        const seg = document.createElement('div');
        seg.className = 'timeline-segment';
        seg.style.background = `linear-gradient(90deg, ${ERA_COLORS[eraForYear(years[Math.max(0, yi - (mi === 0 ? 1 : 0))])].accent}40, ${color}40)`;
        fragment.appendChild(seg);
      }

      const dot = document.createElement('button');
      dot.className = 'timeline-dot';
      dot.style.setProperty('--dot-color', color);
      dot.setAttribute('aria-label', `${m.shortName} (${m.date})`);
      dot.dataset.mechanismId = m.id;

      const tooltip = document.createElement('span');
      tooltip.className = 'timeline-dot__tooltip';
      tooltip.textContent = `${m.shortName} · ${m.date}`;
      dot.appendChild(tooltip);

      dot.addEventListener('click', () => {
        const card = document.getElementById(`card-${m.id}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Flash the card
          card.style.transition = 'box-shadow 0.3s ease';
          card.style.boxShadow = `0 0 30px ${color}40`;
          setTimeout(() => {
            card.style.boxShadow = '';
          }, 1500);
        }
      });

      fragment.appendChild(dot);
    });
  });

  track.appendChild(fragment);

  // Highlight active dot on scroll
  setupActiveTracking(mechanisms);
}

function setupActiveTracking(mechanisms) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id?.replace('card-', '');
        const dot = document.querySelector(`.timeline-dot[data-mechanism-id="${id}"]`);
        if (dot) {
          if (entry.isIntersecting) {
            dot.classList.add('timeline-dot--active');
          } else {
            dot.classList.remove('timeline-dot--active');
          }
        }
      });
    },
    { threshold: 0.3 }
  );

  // Observe after DOM is rendered
  requestAnimationFrame(() => {
    mechanisms.forEach((m) => {
      const card = document.getElementById(`card-${m.id}`);
      if (card) observer.observe(card);
    });
  });
}
