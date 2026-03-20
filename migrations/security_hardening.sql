-- SECURITY: Idempotent hardening migration covering gaps 1..14.
-- Applies server-side anti-abuse structures (device trust, geofence confidence, sliding shadow bans, weighted stats).

BEGIN;

-- Gap 3/2: Device identity trust table + fingerprint components.
CREATE TABLE IF NOT EXISTS device_trust (
  device_hash VARCHAR PRIMARY KEY,
  submission_count_24h INT DEFAULT 0,
  high_velocity BOOLEAN DEFAULT false,
  trust_score INT DEFAULT 100,
  multi_branch_reporter BOOLEAN DEFAULT false,
  last_updated TIMESTAMPTZ,

  -- Gap 3: composite fingerprint components stored separately.
  fp_browser_hash VARCHAR,
  fp_ip_subnet VARCHAR,
  fp_gps_cluster VARCHAR,
  fp_timing_hash VARCHAR
);

-- SECURITY: If `device_trust` already existed from a partial earlier deployment,
-- ensure all expected columns exist (CREATE TABLE IF NOT EXISTS won't backfill missing columns).
ALTER TABLE device_trust
  ADD COLUMN IF NOT EXISTS submission_count_24h INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_velocity BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS multi_branch_reporter BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fp_browser_hash VARCHAR,
  ADD COLUMN IF NOT EXISTS fp_ip_subnet VARCHAR,
  ADD COLUMN IF NOT EXISTS fp_gps_cluster VARCHAR,
  ADD COLUMN IF NOT EXISTS fp_timing_hash VARCHAR;

-- Backfill nulls to prevent logic that expects booleans/numbers from misbehaving.
UPDATE device_trust
SET
  submission_count_24h = COALESCE(submission_count_24h, 0),
  high_velocity = COALESCE(high_velocity, false),
  trust_score = COALESCE(trust_score, 100),
  multi_branch_reporter = COALESCE(multi_branch_reporter, false)
WHERE
  submission_count_24h IS NULL
  OR high_velocity IS NULL
  OR trust_score IS NULL
  OR multi_branch_reporter IS NULL;

-- Gap 2/3/11/12/13: Device trust indices.
CREATE INDEX IF NOT EXISTS idx_device_trust_high_velocity ON device_trust (high_velocity);

-- Gap 1/4/5/9/11/12/13: Extend timer_submissions for confidence, weighting and trigger eligibility.
ALTER TABLE timer_submissions
  ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS submission_confidence VARCHAR DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS low_confidence_period BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_passive_anomaly_candidate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_type_mismatch BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS anomalous_appointment_ratio BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS anomaly_trigger_eligible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_weight DECIMAL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS behavioral_consistency_score INT,
  ADD COLUMN IF NOT EXISTS low_confidence_period_reason VARCHAR;

-- Gap 5: Ensure user_flags exists as JSONB for gating logic.
ALTER TABLE timer_submissions
  ADD COLUMN IF NOT EXISTS user_flags JSONB;

-- Backfill nulls for any pre-existing rows so the security view/queries behave deterministically.
UPDATE timer_submissions
SET
  submission_confidence = COALESCE(submission_confidence, 'high'),
  low_confidence_period = COALESCE(low_confidence_period, false),
  is_passive_anomaly_candidate = COALESCE(is_passive_anomaly_candidate, false),
  queue_type_mismatch = COALESCE(queue_type_mismatch, false),
  anomalous_appointment_ratio = COALESCE(anomalous_appointment_ratio, false),
  anomaly_trigger_eligible = COALESCE(anomaly_trigger_eligible, false),
  submission_weight = COALESCE(submission_weight, 1.0),
  user_flags = COALESCE(user_flags, '[]'::jsonb)
WHERE
  submission_confidence IS NULL
  OR low_confidence_period IS NULL
  OR is_passive_anomaly_candidate IS NULL
  OR queue_type_mismatch IS NULL
  OR anomalous_appointment_ratio IS NULL
  OR anomaly_trigger_eligible IS NULL
  OR submission_weight IS NULL
  OR user_flags IS NULL;

-- Gap 7: Tier-1 baseline cache per branch and day-of-week.
CREATE TABLE IF NOT EXISTS branch_rolling_stats (
  branch_id UUID,
  day_of_week INT,
  walkin_trimmed_mean_seconds INT,
  walkin_p25_seconds INT,
  walkin_p75_seconds INT,
  sample_size INT,
  last_updated TIMESTAMPTZ,
  PRIMARY KEY (branch_id, day_of_week)
);

-- Gap 9: Queue prefix patterns per branch.
CREATE TABLE IF NOT EXISTS queue_prefix_patterns (
  branch_id UUID REFERENCES branches(id),
  prefix VARCHAR,
  typical_queue_type VARCHAR,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (branch_id, prefix)
);

-- Gap 5: Pending review queue for non-eligible manual fixer reports.
CREATE TABLE IF NOT EXISTS pending_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  device_hash VARCHAR,
  timer_submission_id UUID UNIQUE,
  payload JSONB,
  reason VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gap 12: anomaly flags with explicit signals for transparency/audit.
CREATE TABLE IF NOT EXISTS anomaly_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  flag_type VARCHAR,
  trigger_count INT DEFAULT 0,
  signal_count INT DEFAULT 0,
  signal_types TEXT[] DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, flag_type)
);

-- SECURITY: If `anomaly_flags` already existed from a partial deployment, ensure columns/defaults exist.
ALTER TABLE anomaly_flags
  ADD COLUMN IF NOT EXISTS signal_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_types TEXT[] DEFAULT '{}'::TEXT[];

-- Backfill nulls so later queries/updates can safely treat these as non-null.
UPDATE anomaly_flags
SET
  signal_count = COALESCE(signal_count, 0),
  signal_types = COALESCE(signal_types, '{}'::TEXT[])
WHERE
  signal_count IS NULL
  OR signal_types IS NULL;

-- Gap 9/14: Drift alert flag on branch.
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS drift_alert BOOLEAN DEFAULT false;

-- Backfill null drift flags for older rows.
UPDATE branches
SET drift_alert = false
WHERE drift_alert IS NULL;

-- Gap 7/1/4/11: branch_daily_stats view with silent abandon count + weighted averages.
-- SECURITY: Silent abandons are computed from active sessions older than 3 hours.
DROP VIEW IF EXISTS branch_daily_stats;
CREATE OR REPLACE VIEW branch_daily_stats AS
SELECT
  b.id AS branch_id,
  CURRENT_DATE AS stat_date,

  -- Gap 1: silent abandons likely fixer clients starting the timer and never completing.
  COALESCE((
    SELECT COUNT(*)
    FROM active_sessions s
    WHERE s.branch_id = b.id
      AND s.started_at <= NOW() - INTERVAL '3 hours'
      AND s.is_completed = false
  ), 0) AS silent_abandon_count,

  -- Gap 10/11/4: weighted walk-in averages (low confidence weighted at 50%).
  COALESCE(
    SUM(
      CASE
        WHEN ts.queue_type = 'walk-in' OR ts.queue_type_mismatch = true THEN
          ts.wait_time_seconds * ts.submission_weight::float *
          CASE WHEN ts.submission_confidence = 'low' OR ts.low_confidence_period THEN 0.5 ELSE 1 END
        ELSE 0
      END
    ) / NULLIF(
      SUM(
        CASE
          WHEN ts.queue_type = 'walk-in' OR ts.queue_type_mismatch = true THEN
            ts.submission_weight::float *
            CASE WHEN ts.submission_confidence = 'low' OR ts.low_confidence_period THEN 0.5 ELSE 1 END
          ELSE 0
        END
      ),
      0
    ),
  0) AS walkin_avg_seconds,

  COUNT(ts.id) FILTER (WHERE (ts.queue_type = 'walk-in' OR ts.queue_type_mismatch = true)) AS walkin_report_count,

  -- Appointment averages (mismatches count as walk-in above by design).
  COALESCE(
    SUM(
      CASE
        WHEN ts.queue_type = 'appointment' AND NOT ts.queue_type_mismatch THEN
          ts.wait_time_seconds * ts.submission_weight::float *
          CASE WHEN ts.submission_confidence = 'low' OR ts.low_confidence_period THEN 0.5 ELSE 1 END
        ELSE 0
      END
    ) / NULLIF(
      SUM(
        CASE
          WHEN ts.queue_type = 'appointment' AND NOT ts.queue_type_mismatch THEN
            ts.submission_weight::float *
            CASE WHEN ts.submission_confidence = 'low' OR ts.low_confidence_period THEN 0.5 ELSE 1 END
          ELSE 0
        END
      ),
      0
    ),
  0) AS appointment_avg_seconds,

  COUNT(ts.id) FILTER (WHERE ts.queue_type = 'appointment' AND NOT ts.queue_type_mismatch) AS appointment_report_count,

  COALESCE(AVG(pq.wait_seconds) / 60, 0) AS avg_prequeue_minutes,

  -- Gap 6: keep existing PUNO exposure fields.
  COALESCE(bds.is_puno, false) AS is_puno,
  bds.puno_reported_at
FROM branches b
LEFT JOIN timer_submissions ts
  ON b.id = ts.branch_id
  AND DATE(ts.submitted_at) = CURRENT_DATE
  AND NOT ts.is_shadow_banned AND NOT ts.is_outlier
LEFT JOIN prequeue_waits pq
  ON b.id = pq.branch_id
  AND DATE(pq.ended_at) = CURRENT_DATE
LEFT JOIN branch_daily_status bds
  ON b.id = bds.branch_id
  AND bds.date = CURRENT_DATE
GROUP BY b.id, bds.is_puno, bds.puno_reported_at;

COMMIT;

