/**
 * Attention Timeline — Main Entry Point
 *
 * Orchestrates the timeline, cards, comparison, and diagrams.
 */

import './style.css';
import { mechanisms, ERA_NARRATIVES, ERA_COLORS } from './data/mechanisms.js';
import { renderTimeline } from './components/timeline.js';
import { renderCards } from './components/cards.js';
import { initComparison } from './components/comparison.js';
import { createDiagram } from './components/diagrams.js';

// ── State ─────────────────────────────────────────────────────────
const state = {
  expandedCards: new Set(),
  selectedForComparison: new Set(),
};

// ── Initialize ────────────────────────────────────────────────────
function init() {
  renderTimeline(mechanisms, ERA_COLORS);
  renderCards(mechanisms, ERA_NARRATIVES, ERA_COLORS, state, { createDiagram });
  initComparison(mechanisms, state, ERA_COLORS);
  setupScrollCue();
  setupIntersectionObserver();
}

// ── Scroll Cue ────────────────────────────────────────────────────
function setupScrollCue() {
  const cue = document.getElementById('scroll-cue');
  if (cue) {
    cue.addEventListener('click', () => {
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

// ── Intersection Observer for Animations ──────────────────────────
function setupIntersectionObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
  );

  // Observe cards and era headers after DOM settles
  requestAnimationFrame(() => {
    document.querySelectorAll('.mechanism-card, .era-header').forEach((el) => {
      el.classList.add('animate-pending');
      observer.observe(el);
    });
  });
}

// ── Boot ──────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
