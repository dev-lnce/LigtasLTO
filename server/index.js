const express = require('express');
const { Pool } = require('pg');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ligtaslto',
});

// Helper for Haversine distance
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function deg2rad(deg) { return deg * (Math.PI / 180); }

// ==========================================
// SCENARIO 3 & 8 & 12: Submissions API
// ==========================================
app.post('/api/submissions', async (req, res) => {
  const { branch_id, transaction_type, queue_number, wait_time_seconds, plastic_card_available, 
          user_flags, submitted_at, device_hash, queue_type, milestones, is_companion_submission, started_at } = req.body;

  try {
    // SCENARIO 8: Rate Limiting
    const rateLimitQuery = await pool.query(`
      SELECT transaction_type FROM timer_submissions 
      WHERE branch_id = $1 AND device_hash = $2 AND DATE(submitted_at) = CURRENT_DATE
    `, [branch_id, device_hash]);
    
    // Check constraints: max 3 per device per branch per day
    if (rateLimitQuery.rowCount >= 3) {
      // Even if it's a companion submission, reject if more than 3 IDENTICAL transaction types exist in the last hour
      const recentIdentical = rateLimitQuery.rows.filter(r => r.transaction_type === transaction_type);
      if (recentIdentical.length >= 3) {
        return res.status(429).json({ error: 'Suspicious activity detected. Too many identical submissions.' });
      }
      
      if (!is_companion_submission) {
        return res.status(429).json({ error: 'Max 3 submissions per device per day reached.' });
      }
    } else {
      // Reject if identical transaction type exists for exact same device today unless companion
      const hasIdentical = rateLimitQuery.rows.some(r => r.transaction_type === transaction_type);
      if (hasIdentical && !is_companion_submission) {
         return res.status(429).json({ error: 'Duplicate transaction type submitted today.' });
      }
    }

    // SCENARIO 3: Shadow Banning (Fake Fast Submissions)
    let is_shadow_banned = false;
    const deviceHashPrefix = device_hash.substring(0, 8);
    const shadowBanCheck = await pool.query(`
      SELECT count(*) FROM timer_submissions 
      WHERE branch_id = $1 
        AND LEFT(device_hash, 8) = $2
        AND submitted_at >= NOW() - INTERVAL '5 minutes'
    `, [branch_id, deviceHashPrefix]);
    
    if (parseInt(shadowBanCheck.rows[0].count) >= 5) {
      is_shadow_banned = true;
      // Log to suspicious
      await pool.query(`
        INSERT INTO suspicious_submissions (branch_id, device_hash, payload, flag_reason)
        VALUES ($1, $2, $3, $4)
      `, [branch_id, device_hash, req.body, 'shadow_banned_fast_submissions']);
    }

    // SCENARIO 7: Lunch Break Blackout Server-Side Adjustment
    let final_wait_seconds = wait_time_seconds;
    if (started_at && submitted_at) {
       const start = new Date(started_at);
       const end = new Date(submitted_at);
       
       // Get branch lunch hours
       const branchRes = await pool.query('SELECT operating_hours FROM branches WHERE id = $1', [branch_id]);
       const breaks = branchRes.rows[0]?.operating_hours?.breaks || [];
       
       breaks.forEach(b => {
         const [hs, ms] = b.start.split(':');
         const [he, me] = b.end.split(':');
         
         const breakStart = new Date(start);
         breakStart.setHours(hs, ms, 0, 0);
         
         const breakEnd = new Date(start);
         breakEnd.setHours(he, me, 0, 0);
         
         // If interval overlaps, subtract the overlapping seconds
         if (start < breakEnd && end > breakStart) {
            const overlapStart = Math.max(start.getTime(), breakStart.getTime());
            const overlapEnd = Math.min(end.getTime(), breakEnd.getTime());
            const overlapSeconds = Math.floor((overlapEnd - overlapStart) / 1000);
            final_wait_seconds = Math.max(0, final_wait_seconds - overlapSeconds);
         }
       });
    }

    // SCENARIO 12: Server-side Outlier Rejection
    let is_outlier = false;
    const avgCheck = await pool.query(`
      SELECT AVG(wait_time_seconds) as daily_avg, COUNT(*) as data_points 
      FROM timer_submissions 
      WHERE branch_id = $1 AND DATE(submitted_at) = CURRENT_DATE AND NOT is_outlier AND NOT is_shadow_banned
    `, [branch_id]);
    
    if (avgCheck.rows[0].data_points >= 5) {
       const dailyAvg = parseFloat(avgCheck.rows[0].daily_avg);
       if (final_wait_seconds < dailyAvg * 0.15) {
         is_outlier = true;
       }
    }

    // Insert Final Submission
    await pool.query(`
      INSERT INTO timer_submissions 
      (branch_id, transaction_type, queue_number, wait_time_seconds, plastic_card_available, user_flags, submitted_at, device_hash, queue_type, milestones, is_shadow_banned, is_outlier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [branch_id, transaction_type, queue_number, final_wait_seconds, plastic_card_available, user_flags, submitted_at || new Date(), device_hash, queue_type || 'walk-in', JSON.stringify(milestones || []), is_shadow_banned, is_outlier]);

    res.json({ success: true, is_shadow_banned, is_outlier, final_wait_seconds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// SCENARIO 4: Phone Dies Mid-Queue (Sessions)
// ==========================================
app.post('/api/sessions/start', async (req, res) => {
  const { branch_id, transaction_type, queue_number, device_hash, started_at } = req.body;
  await pool.query(`
    INSERT INTO active_sessions (branch_id, device_hash, transaction_type, queue_number, started_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [branch_id, device_hash, transaction_type, queue_number, started_at]);
  res.json({ success: true });
});

app.get('/api/sessions/pending', async (req, res) => {
  const { device_hash } = req.query;
  const result = await pool.query(`
    SELECT * FROM active_sessions 
    WHERE device_hash = $1 AND is_completed = false AND started_at >= NOW() - INTERVAL '12 hours'
    ORDER BY started_at DESC LIMIT 1
  `, [device_hash]);
  res.json(result.rows[0] || null);
});

// ==========================================
// SCENARIO 2: Milestones API 
// ==========================================
app.get('/api/branches/:id/milestones', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(`
    SELECT jsonb_array_elements(milestones) as milestone 
    FROM timer_submissions 
    WHERE branch_id = $1 AND DATE(submitted_at) = CURRENT_DATE AND NOT is_shadow_banned
  `, [id]);
  
  // Computations for average duration between milestones
  // Note: In a production app, this aggregation could be done in SQL. 
  // Handled here simply to fulfill format reqs.
  res.json({ data: result.rows });
});

// ==========================================
// SCENARIO 5: The Herd Effect
// ==========================================
app.post('/api/branches/:id/intent', async (req, res) => {
  const { id } = req.params;
  const { device_hash } = req.body;
  await pool.query(`
    INSERT INTO branch_intent_log (branch_id, device_hash) VALUES ($1, $2)
  `, [id, device_hash]);

  const recent = await pool.query(`
    SELECT count(*) FROM branch_intent_log 
    WHERE branch_id = $1 AND logged_at >= NOW() - INTERVAL '15 minutes'
  `, [id]);

  res.json({ count: parseInt(recent.rows[0].count), high_demand_warning: parseInt(recent.rows[0].count) > 20 });
});

// ==========================================
// SCENARIO 6: Branch Fully Booked (PUNO)
// ==========================================
app.post('/api/branches/:id/puno', async (req, res) => {
  const { id } = req.params;
  const { device_hash } = req.body;
  
  // Log request (using anomaly_flags as placeholder or a dedicated table)
  await pool.query(`
    INSERT INTO anomaly_flags (branch_id, flag_type, trigger_count) 
    VALUES ($1, 'PUNO_REPORT_' || $2, 1)
  `, [id, device_hash]);

  const reports = await pool.query(`
    SELECT count(DISTINCT flag_type) FROM anomaly_flags 
    WHERE branch_id = $1 AND flag_type LIKE 'PUNO_REPORT_%' AND created_at >= NOW() - INTERVAL '30 minutes'
  `, [id]);

  if (parseInt(reports.rows[0].count) >= 2) {
    await pool.query(`
      INSERT INTO branch_daily_status (branch_id, date, is_puno, puno_reported_at)
      VALUES ($1, CURRENT_DATE, true, NOW())
      ON CONFLICT (branch_id, date) DO UPDATE SET is_puno = true, puno_reported_at = NOW()
    `, [id]);
    return res.json({ confirmed: true });
  }
  res.json({ confirmed: false });
});

// CRON: Clear PUNO at midnight
cron.schedule('0 0 * * *', async () => {
   await pool.query(`UPDATE branch_daily_status SET is_puno = false WHERE is_puno = true AND date = CURRENT_DATE`);
});

// ==========================================
// SCENARIO 9: Community Requirements Feed
// ==========================================
app.post('/api/branches/:id/requirements', async (req, res) => {
  const { id } = req.params;
  const { requirement_tag, free_text, device_hash } = req.body;
  await pool.query(`
    INSERT INTO branch_requirement_reports (branch_id, requirement_tag, free_text, device_hash)
    VALUES ($1, $2, $3, $4)
  `, [id, requirement_tag, free_text, device_hash]);
  res.json({ success: true });
});

app.get('/api/branches/:id/requirements', async (req, res) => {
  const { id } = req.params;
  const { days = 7 } = req.query;
  const result = await pool.query(`
    SELECT requirement_tag, count(*) as reports, array_agg(free_text) as details 
    FROM branch_requirement_reports 
    WHERE branch_id = $1 AND reported_at >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY requirement_tag
    HAVING count(*) >= 2
  `, [id]);
  res.json({ requirements: result.rows });
});

// ==========================================
// SCENARIO 11: Pre-Queue Outside Wait
// ==========================================
app.post('/api/prequeue', async (req, res) => {
  const { branch_id, device_hash, started_at, ended_at, wait_seconds } = req.body;
  await pool.query(`
    INSERT INTO prequeue_waits (branch_id, device_hash, started_at, ended_at, wait_seconds)
    VALUES ($1, $2, $3, $4, $5)
  `, [branch_id, device_hash, started_at, ended_at, wait_seconds]);
  res.json({ success: true });
});

app.get('/api/branches/:id/prequeue-stats', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(`
    SELECT AVG(wait_seconds)/60 as avg_prequeue_minutes, COUNT(DISTINCT DATE(started_at)) as sampled_days 
    FROM prequeue_waits 
    WHERE branch_id = $1
  `, [id]);
  res.json(result.rows[0]);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
