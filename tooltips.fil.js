export const TOOLTIPS = {
  'Walk-in': {
    body: 'Walang appointment. Pumipila ka gamit ang oras kung kailan ka dumating.',
    icon: 'directions_walk',
  },
  Appointment: {
    body: 'May nakatakdang oras o reserbasyon. Dumaan ka sa schedule mo.',
    icon: 'event',
  },
  'Online Appointment': {
    body: 'Isang reserbasyon na ginawa online bago pumunta sa LTO.',
    icon: 'schedule',
  },
  'MV Registration': {
    body: 'Pagpaparehistro ng sasakyan sa LTO (pagpapalista sa system).',
    icon: 'directions_car',
  },
  Evaluation: {
    body: 'Unang bintana kung saan sinusuri ang mga papeles at impormasyon mo.',
    icon: 'fact_check',
  },
  Biometrics: {
    body: 'Bahagi ng proseso kung saan kinukuha ang litrato at fingerprint mo.',
    icon: 'fingerprint',
  },
  'Student Permit': {
    body: 'Aplikasyon para sa student permit bago ka magkaroon ng mas kompleto mong lisensya.',
    icon: 'school',
  },
  MVIR: {
    body: 'MVIR/Inspection report na kailangang maitala para sa ilang uri ng transaksyon.',
    icon: 'description',
  },
  PUNO: {
    body: 'Kapag puno na ang sangay. Ibig sabihin may maubos na quota/queue kaya bumalik na.',
    icon: 'priority_high',
  },
  Anomaly: {
    body: 'Kahina-hinalang aktibidad o ulat na may posibleng paglihis sa tamang proseso sa branch.',
    icon: 'warning',
  },
  'Plastic Card': {
    body: 'Ang plastic ID/card na ibibigay pagkatapos ng proseso (depende sa availability).',
    icon: 'credit_card',
  },
  Branch: {
    body: 'Tanggapan ng LTO na pagdadaanan mo ng proseso at pila.',
    icon: 'location_on',
  },
  Queue: {
    body: 'Ang pila o serye ng tao na inaasikaso sa branch.',
    icon: 'queue',
  },
  Submit: {
    body: 'Pagpasa ng dokumento o ulat sa tamang paraan.',
    icon: 'upload',
  },
  Cancel: {
    body: 'Pag-hinto o pagwawalang-bisa ng proseso.',
    icon: 'cancel',
  },
};

const BADGE_SELECTOR = '[data-tooltip]';

let current = {
  badge: null,
  tooltipEl: null,
};

function makeTooltipEl(badgeEl, key) {
  const def = TOOLTIPS[key];
  if (!def) return null;

  const tooltip = document.createElement('div');
  tooltip.className =
    'ligtaslto-tooltip-card overflow-hidden transition-[max-height] duration-200 ease-out max-h-0 ' +
    'bg-surface-container-lowest dark:bg-slate-800 ' +
    'border border-outline-variant/10 dark:border-slate-600 ' +
    'rounded-lg p-3 text-[13px] leading-relaxed max-w-[260px] mt-1';

  tooltip.setAttribute('role', 'dialog');
  tooltip.dataset.tooltipContent = '1';

  const icon = def.icon
    ? `<div class="flex items-center justify-start gap-2 mb-1">
         <span class="material-symbols-outlined text-[48px] leading-none text-on-surface-variant dark:text-slate-400" style="font-variation-settings:'FILL' 1; font-size:48px;">${def.icon}</span>
       </div>`
    : '';

  tooltip.innerHTML = `
    <div class="font-bold mb-2">${key}</div>
    ${icon}
    <div class="text-on-surface-variant dark:text-slate-300">${def.body}</div>
  `;

  // Insert right after badge for “slides down below the term”
  badgeEl.insertAdjacentElement('afterend', tooltip);

  // Animate in
  requestAnimationFrame(() => {
    tooltip.style.maxHeight = '120px';
  });

  return tooltip;
}

function closeTooltip() {
  if (!current.tooltipEl) return;
  current.tooltipEl.remove();
  current.tooltipEl = null;
  current.badge = null;
}

function openTooltip(badgeEl) {
  const key = badgeEl.getAttribute('data-tooltip');
  if (!key) return;
  if (!TOOLTIPS[key]) return;

  if (current.tooltipEl) closeTooltip();

  const tooltipEl = makeTooltipEl(badgeEl, key);
  if (!tooltipEl) return;

  current.tooltipEl = tooltipEl;
  current.badge = badgeEl;
}

function toggleTooltip(badgeEl) {
  if (current.badge === badgeEl && current.tooltipEl) closeTooltip();
  else openTooltip(badgeEl);
}

function onDocumentClick(e) {
  const target = e.target;
  if (!(target instanceof Element)) return;

  const badge = target.closest(BADGE_SELECTOR);
  if (badge instanceof HTMLElement) {
    // Let explicit badge click toggle; prevent the “outside” handler from instantly closing it.
    e.preventDefault();
    e.stopPropagation();
    toggleTooltip(badge);
    return;
  }

  if (current.tooltipEl && current.tooltipEl.contains(target)) return;

  closeTooltip();
}

function onKeyDown(e) {
  if (e.key === 'Escape') closeTooltip();
}

function initTooltips() {
  // Event delegation: one handler for all tooltips.
  document.addEventListener('click', onDocumentClick, true);
  document.addEventListener('keydown', onKeyDown);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTooltips);
} else {
  initTooltips();
}

// Expose for debugging / future integration.
window.ligtasltoTooltips = { TOOLTIPS };

