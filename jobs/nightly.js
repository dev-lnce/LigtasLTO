// SECURITY: Nightly maintenance job to keep baselines and trust state from being poisoned.

const cron = require('node-cron');

module.exports = function initNightlyJobs(pool, anomalyEngine) {
  // 11:50PM daily.
  cron.schedule(
    '50 23 * * *',
    async () => {
      try {
        // Gap 7/8/13/2 maintenance.
        await anomalyEngine.runNightlyMaintenance();
      } catch (err) {
        console.error('[nightly] maintenance failed:', err);
      }
    },
    {
      // Keep this consistent with Philippine time.
      timezone: 'Asia/Manila',
    }
  );
};

