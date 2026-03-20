// FRONTEND DEMO MODE — localStorage is the single source of truth.
// ThemeContext.tsx also reads/writes the same key for React state.
// scenarioGuards.js imports DEMO_MODE from here for geofence checks.
export const DEMO_MODE = (() => {
  try {
    return localStorage.getItem('ligtaslto_demo_mode') === 'true';
  } catch {
    return false;
  }
})();

export function setDemoMode(enabled) {
  try {
    localStorage.setItem('ligtaslto_demo_mode', enabled ? 'true' : 'false');
  } catch {}
  location.reload(); // reload so all modules re-read DEMO_MODE
}
