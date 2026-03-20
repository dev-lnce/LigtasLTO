export const STRINGS_FIL = {
  'Walk-in': 'Walang appointment',
  'Online Appointment': 'May reserbasyong online',
  Evaluation: 'Unang bintana',
  Biometrics: 'Litrato at fingerprint',
  Cashier: 'Bayad',
  Release: 'Pagkuha ng ID',
  'MV Registration': 'Pagpapalista ng sasakyan',
  Anomaly: 'Kahina-hinalang aktibidad',
  Branch: 'Tanggapan ng LTO',
  Queue: 'Pila',
  Submit: 'Isumite',
  Cancel: 'Huwag na',
  'Student Permit': 'Student Permit',
  MVIR: 'MVIR',
  'Plastic Card': 'Plastic Card',
};

const MODE_KEY = 'ligtaslto_lang';

const originalTextNodes = new WeakMap();
let currentMode = 'eng';

const REPLACEMENTS = Object.entries(STRINGS_FIL).sort((a, b) => b[0].length - a[0].length);

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nodeHasSkipParent(node) {
  if (!node.parentElement) return false;
  return Boolean(
    node.parentElement.closest('script, style, noscript, textarea, input, [data-tooltip-content="1"], [data-tooltip-content="true"]')
  );
}

function replaceInText(text) {
  let out = text;
  for (const [eng, fil] of REPLACEMENTS) {
    // Simple split/join keeps matching exact substrings (case-sensitive).
    out = out.split(eng).join(fil);
  }
  return out;
}

function applyToTextNode(textNode) {
  if (!(textNode instanceof Text)) return;
  if (!textNode.nodeValue) return;
  if (nodeHasSkipParent(textNode)) return;
  if (!REPLACEMENTS.some(([eng]) => textNode.nodeValue.includes(eng))) return;

  if (!originalTextNodes.has(textNode)) originalTextNodes.set(textNode, textNode.nodeValue);
  textNode.nodeValue = replaceInText(textNode.nodeValue);
}

function restoreTextNode(textNode) {
  if (!(textNode instanceof Text)) return;
  const original = originalTextNodes.get(textNode);
  if (typeof original === 'string') textNode.nodeValue = original;
}

function scanAndApply(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      // When restoring, revert nodes we previously touched.
      if (currentMode !== 'fil') {
        return originalTextNodes.has(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
      // Skip nodes with no replacement keys
      for (const [eng] of REPLACEMENTS) {
        if (node.nodeValue.includes(eng)) return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_REJECT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    if (currentMode === 'fil') applyToTextNode(n);
    else restoreTextNode(n);
  }
}

let observer = null;
function ensureObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    if (currentMode !== 'fil') return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        scanAndApply(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function setMode(mode) {
  const next = mode === 'fil' ? 'fil' : 'eng';
  currentMode = next;
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {}

  if (currentMode === 'fil') {
    scanAndApply();
    ensureObserver();
  } else {
    // Restore any nodes we touched before
    scanAndApply(); // will restore since currentMode !== 'fil'
  }
}

function initFromStorage() {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'fil') currentMode = 'fil';
  } catch {}
  if (currentMode === 'fil') {
    scanAndApply();
    ensureObserver();
  }
}

initFromStorage();

// Expose for React toggle button
window.ligtasltoStringsFil = {
  STRINGS_FIL,
  setLangMode: setMode,
  getMode: () => currentMode,
};

