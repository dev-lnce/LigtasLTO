const ONBOARDED_KEY = 'ligtaslto_onboarded';
const TRANSACTION_KEY = 'ligtaslto_transaction';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function isOnboarded() {
  return safeGet(ONBOARDED_KEY) === 'true';
}

function getSavedTransactionType() {
  return safeGet(TRANSACTION_KEY);
}

function setOnboardingSelection(selectedType) {
  safeSet(TRANSACTION_KEY, selectedType);
  safeSet(ONBOARDED_KEY, 'true');
  window.dispatchEvent(new CustomEvent('ligtaslto:onboarding-complete', { detail: { selectedType } }));
}

function requestOnboardingOverlay() {
  window.dispatchEvent(new CustomEvent('ligtaslto:onboarding-open'));
}

window.ligtasltoOnboarding = {
  isOnboarded,
  getSavedTransactionType,
  setOnboardingSelection,
  requestOnboardingOverlay,
};

export { isOnboarded, getSavedTransactionType, setOnboardingSelection, requestOnboardingOverlay };

