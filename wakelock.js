let wakeLock = null;
let keepAwake = false;
let isListening = false;

function notify(active) {
  window.dispatchEvent(new CustomEvent('ligtaslto:wakeLock-change', { detail: { active } }));
}

async function requestWakeLock() {
  keepAwake = true;

  // Respect existing wake locks if supported.
  if (wakeLock) return wakeLock;
  if (!('wakeLock' in navigator)) return null;

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    notify(true);
    return wakeLock;
  } catch {
    wakeLock = null;
    notify(false);
    return null;
  } finally {
    if (!isListening) {
      isListening = true;
      document.addEventListener('visibilitychange', () => {
        if (!keepAwake) return;

        if (document.visibilityState === 'hidden') {
          // Release on background, but keep “keepAwake” intent so we can re-request on return.
          if (wakeLock) {
            try {
              wakeLock.release();
            } catch {}
            wakeLock = null;
            notify(false);
          }
        } else {
          // Re-request when returning to foreground.
          if (!wakeLock) requestWakeLock();
        }
      });
    }
  }
}

function releaseWakeLockInternal({ preserveKeepAwake } = { preserveKeepAwake: false }) {
  const had = Boolean(wakeLock);

  if (wakeLock) {
    try {
      wakeLock.release();
    } catch {}
  }
  wakeLock = null;

  if (!preserveKeepAwake) keepAwake = false;
  if (had) notify(false);
}

function releaseWakeLock() {
  releaseWakeLockInternal({ preserveKeepAwake: false });
}

// Expose global helpers for React components (no TS import needed).
window.ligtasltoWakeLock = {
  requestWakeLock,
  releaseWakeLock,
  isActive: () => Boolean(wakeLock),
};

export { requestWakeLock, releaseWakeLock };

