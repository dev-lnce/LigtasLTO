export const vibrateSafe = (ms: number) => {
  // IMPROVEMENT 5: Wrap navigator.vibrate in try/catch for unsupported browsers.
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

