-- LigtasLTO Edge Case Scenarios - Consolidated Migration

-- Scenario 2: Multi-Window Milestone Tracking
-- Added 'milestones' to track individual window timestamps
ALTER TABLE timer_submissions 
ADD COLUMN IF NOT EXISTS milestones JSONB;

-- Scenario 3: Fixer Sabotage via Fake Fast Submissions
-- Created suspicious_submissions table for shadow-banned logs
CREATE TABLE IF NOT EXISTS suspicious_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  device_hash VARCHAR,
  payload JSONB,
  flag_reason VARCHAR,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE timer_submissions
ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT false;

-- Scenario 4: Phone Dies Mid-Queue
-- Server-side session tracking
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  device_hash VARCHAR,
  transaction_type VARCHAR,
  queue_number VARCHAR,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  is_completed BOOLEAN DEFAULT false
);

-- Scenario 5: The Herd Effect
-- Tracking user intent to visit branch
CREATE TABLE IF NOT EXISTS branch_intent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  device_hash VARCHAR,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario 6: Branch Fully Booked (PUNO)
-- Scenario 7: Lunch Break Blackout
-- Scenario 10: Walk-in vs Appointment
CREATE TABLE IF NOT EXISTS branch_daily_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  date DATE DEFAULT CURRENT_DATE,
  is_puno BOOLEAN DEFAULT false,
  puno_reported_at TIMESTAMPTZ,
  UNIQUE(branch_id, date)
);

ALTER TABLE branches
ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{"open": "08:00", "close": "17:00", "breaks": [{"start": "12:00", "end": "13:00", "label": "Lunch Break"}]}';

-- Scenario 9: Unofficial Branch Requirements
CREATE TABLE IF NOT EXISTS branch_requirement_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  requirement_tag VARCHAR,
  free_text VARCHAR,
  device_hash VARCHAR,
  reported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario 11: Pre-Queue Outside Wait
CREATE TABLE IF NOT EXISTS prequeue_waits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  device_hash VARCHAR,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  wait_seconds INT
);

-- Scenario 12: Accidental Submission
ALTER TABLE timer_submissions
ADD COLUMN IF NOT EXISTS is_outlier BOOLEAN DEFAULT false;


-- Scenario 6, 7, 10, 11: Update branch_daily_stats computed view
-- Drop existing view if it exists (assuming it was a standard view or materialized)
DROP VIEW IF EXISTS branch_daily_stats;

CREATE OR REPLACE VIEW branch_daily_stats AS
SELECT 
  b.id AS branch_id,
  CURRENT_DATE AS stat_date,
  
  -- Scenario 10: Walk-in vs Appointment splitting
  COALESCE(AVG(ts.wait_time_seconds) FILTER (WHERE ts.queue_type = 'walk-in' AND NOT ts.is_shadow_banned AND NOT ts.is_outlier), 0) AS walkin_avg_seconds,
  COUNT(ts.id) FILTER (WHERE ts.queue_type = 'walk-in' AND NOT ts.is_shadow_banned AND NOT ts.is_outlier) AS walkin_report_count,
  
  COALESCE(AVG(ts.wait_time_seconds) FILTER (WHERE ts.queue_type = 'appointment' AND NOT ts.is_shadow_banned AND NOT ts.is_outlier), 0) AS appointment_avg_seconds,
  COUNT(ts.id) FILTER (WHERE ts.queue_type = 'appointment' AND NOT ts.is_shadow_banned AND NOT ts.is_outlier) AS appointment_report_count,
  
  -- Scenario 11: Prequeue stats
  COALESCE(AVG(pq.wait_seconds) / 60, 0) AS avg_prequeue_minutes,
  
  -- Scenario 6: Puno status
  COALESCE(bds.is_puno, false) AS is_puno,
  bds.puno_reported_at
FROM branches b
LEFT JOIN timer_submissions ts 
  ON b.id = ts.branch_id 
  AND DATE(ts.submitted_at) = CURRENT_DATE
LEFT JOIN prequeue_waits pq 
  ON b.id = pq.branch_id 
  AND DATE(pq.ended_at) = CURRENT_DATE
LEFT JOIN branch_daily_status bds 
  ON b.id = bds.branch_id 
  AND bds.date = CURRENT_DATE
GROUP BY b.id, bds.is_puno, bds.puno_reported_at;
