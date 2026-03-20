const express = require('express');
const { Pool } = require('pg');
const cron = require('node-cron');
const cors = require('cors');

const createAnomalyEngine = require('../services/anomalyEngine');
const initNightlyJobs = require('../jobs/nightly');
const anomalyConfig = require('../config/anomaly.js');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const app = express();
app.use(cors());
app.use(express.json());

// SECURITY FIX: lightweight in-memory stores for features whose UI currently
// doesn't send enough identity to key rows in PostgreSQL.
const savedBranchesByIp = new Map(); // ip -> string[]

function ipKey(req) {
  const xff = req?.headers?.['x-forwarded-for'];
  const ip = typeof xff === 'string' && xff.length ? xff.split(',')[0].trim() : req?.ip;
  return ip || 'unknown';
}

// Initialize PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ligtaslto',
});

// SECURITY: Centralize all anomaly detection logic in anomalyEngine.
const anomalyEngine = createAnomalyEngine(pool);
initNightlyJobs(pool, anomalyEngine);

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
  const {
    branch_id,
    transaction_type,
    queue_number,
    wait_time_seconds,
    plastic_card_available,
    user_flags,
    submitted_at,
    device_hash, // SECURITY: browser fingerprint hash (fp_browser_hash) from client.
    queue_type,
    milestones,
    started_at,
    gps_lat,
    gps_lng,
  } = req.body;

  let insertedSubmissionId = null;
  const userFlagsPayload = Array.isArray(user_flags) ? user_flags : [];
  try {
    // SECURITY: require GPS coordinates for geofence validation (Gap 4).
    if (!process.env.DEMO_MODE || process.env.DEMO_MODE !== 'true') {
      if (typeof gps_lat !== 'number' || typeof gps_lng !== 'number') {
        return res.status(422).json({
          error: 'MISSING_LOCATION',
          message: 'Kailangan mong magsend ng GPS coordinates para mag-submit.',
        });
      }
    }

    const branchRes = await pool.query('SELECT id, lat, lng, operating_hours FROM branches WHERE id = $1', [branch_id]);
    const branch = branchRes.rows[0];
    if (!branch) return res.status(404).json({ error: 'BRANCH_NOT_FOUND' });

    // SECURITY: multi-factor device fingerprint resolution.
    const device = await anomalyEngine.resolveDevice(req, gps_lat, gps_lng, device_hash);

    // SECURITY: lunch-break blackout server-side adjustment retained (non-security).
    let final_wait_seconds = wait_time_seconds;
    if (started_at && submitted_at) {
      const start = new Date(started_at);
      const end = new Date(submitted_at);

      const breaks = branch?.operating_hours?.breaks || [];
      breaks.forEach((b) => {
        const [hs, ms] = b.start.split(':');
        const [he, me] = b.end.split(':');

        const breakStart = new Date(start);
        breakStart.setHours(hs, ms, 0, 0);

        const breakEnd = new Date(start);
        breakEnd.setHours(he, me, 0, 0);

        if (start < breakEnd && end > breakStart) {
          const overlapStart = Math.max(start.getTime(), breakStart.getTime());
          const overlapEnd = Math.min(end.getTime(), breakEnd.getTime());
          const overlapSeconds = Math.floor((overlapEnd - overlapStart) / 1000);
          final_wait_seconds = Math.max(0, final_wait_seconds - overlapSeconds);
        }
      });
    }

    // Insert base submission first; evaluate() updates risk fields silently.
    const insertRes = await pool.query(
      `
        INSERT INTO timer_submissions
          (branch_id, transaction_type, queue_number, wait_time_seconds, plastic_card_available, user_flags,
           submitted_at, device_hash, queue_type, milestones, is_shadow_banned, is_outlier, gps_lat, gps_lng)
        VALUES
          ($1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, false, false, $11, $12)
        RETURNING id
      `,
      [
        branch_id,
        transaction_type,
        queue_number,
        final_wait_seconds,
        plastic_card_available,
        JSON.stringify(userFlagsPayload),
        submitted_at || new Date(),
        device.deviceHash,
        queue_type || 'walk-in',
        JSON.stringify(milestones || []),
        gps_lat,
        gps_lng,
      ]
    );

    insertedSubmissionId = insertRes.rows[0].id;
    const savedSubmission = { id: insertedSubmissionId };

    const evalResult = await anomalyEngine.evaluate(savedSubmission, device, branch);

    // SECURITY: mark any active session started by the browser fingerprint as completed (Gap 1 silent abandon prevention).
    if (started_at) {
      await pool.query(
        `
          UPDATE active_sessions
          SET is_completed = true
          WHERE branch_id = $1 AND device_hash = $2 AND started_at = $3 AND is_completed = false
        `,
        [branch_id, device_hash, started_at]
      );
    }

    res.json(evalResult);
  } catch (error) {
    // SECURITY: rollback-location reject by deleting the inserted submission.
    try {
      if (error?.payload?.error === 'LOCATION_TOO_FAR' && error?.payload) {
        // If anomalyEngine threw LOCATION_TOO_FAR, respond with the exact required message.
        if (insertedSubmissionId) {
          await pool.query(`DELETE FROM timer_submissions WHERE id = $1`, [insertedSubmissionId]);
        }
        return res.status(error.statusCode || 422).json(error.payload);
      }
    } catch {}

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==============================
// Integration gaps (OCR + saved branches)
// ==============================
app.post('/api/ocr-check', async (req, res) => {
  const { mode, image_base64 } = req.body || {};
  if (DEMO_MODE) {
    // Demo: return a stable queue number for UI to populate.
    return res.json({ queue_number: 'B-078' });
  }

  // Non-demo OCR integration is not bundled in this build.
  return res.status(501).json({ error: 'OCR_NOT_IMPLEMENTED', mode: mode || null });
});

app.get('/api/branches/saved', async (req, res) => {
  const key = ipKey(req);
  const branch_ids = savedBranchesByIp.get(key) || [];
  res.json({ branch_ids });
});

app.post('/api/branches/save', async (req, res) => {
  const { branch_ids } = req.body || {};
  const key = ipKey(req);
  const ids = Array.isArray(branch_ids) ? branch_ids : [];
  savedBranchesByIp.set(key, ids.slice(0, 10));
  res.json({ success: true });
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
// SECURITY: Gap 14 window disparity evidence trail + bottleneck analytics for integrity/audit.
app.get('/api/branches/:id/milestones', async (req, res) => {
  const { id } = req.params;

  const toLabels = {
    evaluation: 'Evaluation Done',
    photo: 'Photo/Biometrics Done',
    cashier: 'Paid Cashier',
    release: 'Received ID/Papers',
  };

  function parseMilestones(milestones) {
    const ms = Array.isArray(milestones) ? milestones : [];
    const map = {};
    for (const item of ms) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.milestone === 'string' && typeof item.completed_at === 'string') {
        map[item.milestone] = new Date(item.completed_at).getTime();
      }
    }
    return map;
  }

  function transitionMinutes(m, fromLabel, toLabel) {
    const a = m[fromLabel];
    const b = m[toLabel];
    if (!a || !b) return null;
    return (b - a) / 60000;
  }

  const res28 = await pool.query(
    `
      SELECT device_hash, submitted_at, milestones
      FROM timer_submissions
      WHERE branch_id = $1
        AND submitted_at >= NOW() - INTERVAL '28 days'
        AND NOT is_shadow_banned
        AND milestones IS NOT NULL
    `,
    [id]
  );

  const rows = res28.rows || [];

  const todayCutoff = new Date();
  todayCutoff.setHours(0, 0, 0, 0);
  const weekCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const acc = {
    eval_photo: { today: [], week: [], rolling: [] },
    photo_cashier: { today: [], week: [], rolling: [] },
    cashier_release: { today: [], week: [], rolling: [] },
  };

  const todayByDevice = new Map(); // device_hash -> list of eval->photo minutes (today only)

  for (const r of rows) {
    const submittedAt = new Date(r.submitted_at);
    const isToday = submittedAt >= todayCutoff && submittedAt < new Date(todayCutoff.getTime() + 24 * 60 * 60 * 1000);
    const isWeek = submittedAt >= weekCutoff;

    const m = parseMilestones(r.milestones);

    const evalPhoto = transitionMinutes(m, toLabels.evaluation, toLabels.photo);
    const photoCashier = transitionMinutes(m, toLabels.photo, toLabels.cashier);
    const cashierRelease = transitionMinutes(m, toLabels.cashier, toLabels.release);

    if (evalPhoto !== null) {
      acc.eval_photo.rolling.push(evalPhoto);
      if (isWeek) acc.eval_photo.week.push(evalPhoto);
      if (isToday) acc.eval_photo.today.push(evalPhoto);
      if (isToday) {
        const list = todayByDevice.get(r.device_hash) || [];
        list.push(evalPhoto);
        todayByDevice.set(r.device_hash, list);
      }
    }
    if (photoCashier !== null) {
      acc.photo_cashier.rolling.push(photoCashier);
      if (isWeek) acc.photo_cashier.week.push(photoCashier);
      if (isToday) acc.photo_cashier.today.push(photoCashier);
    }
    if (cashierRelease !== null) {
      acc.cashier_release.rolling.push(cashierRelease);
      if (isWeek) acc.cashier_release.week.push(cashierRelease);
      if (isToday) acc.cashier_release.today.push(cashierRelease);
    }
  }

  function avg(list) {
    if (!list || list.length === 0) return null;
    return list.reduce((a, b) => a + b, 0) / list.length;
  }

  // SECURITY: Gap 14 - window disparity detection (today only).
  // If some devices show extremely faster/slower eval->photo times on the same day, flag the branch.
  const deviceAvg = [];
  for (const [deviceHash, list] of todayByDevice.entries()) {
    if (list.length >= 2) {
      deviceAvg.push({ deviceHash, avg: avg(list) });
    }
  }

  if (deviceAvg.length >= 3) {
    const values = deviceAvg.map((d) => d.avg).filter((x) => x !== null);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min > 0 && (max / min) >= 20 && (max - min) >= 20) {
      await pool.query(
        `
          INSERT INTO anomaly_flags (branch_id, flag_type, trigger_count, signal_count, signal_types, created_at)
          VALUES ($1, 'window_disparity', 1, 1, $2, NOW())
          ON CONFLICT (branch_id, flag_type) DO UPDATE SET
            trigger_count = anomaly_flags.trigger_count + 1,
            created_at = NOW()
        `,
        [id, ['window_disparity']]
      );
    }
  }

  res.json({
    transitions: [
      {
        transition: 'evaluation_to_photo',
        today_minutes_avg: avg(acc.eval_photo.today),
        week_minutes_avg: avg(acc.eval_photo.week),
        rolling_4week_minutes_avg: avg(acc.eval_photo.rolling),
      },
      {
        transition: 'photo_to_cashier',
        today_minutes_avg: avg(acc.photo_cashier.today),
        week_minutes_avg: avg(acc.photo_cashier.week),
        rolling_4week_minutes_avg: avg(acc.photo_cashier.rolling),
      },
      {
        transition: 'cashier_to_release',
        today_minutes_avg: avg(acc.cashier_release.today),
        week_minutes_avg: avg(acc.cashier_release.week),
        rolling_4week_minutes_avg: avg(acc.cashier_release.rolling),
      },
    ],
    flag_type: 'window_disparity',
    // SECURITY: public description is stored by admin/consumer mapping layer.
    public_description:
      'May malaking pagkakaiba sa oras ng proseso sa iisang window ngayon.',
  });

  // SECURITY: TODO: Backend milestone analytics will later be connected to an admin transparency dashboard.
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
  
  if (DEMO_MODE) {
    await pool.query(`
      INSERT INTO branch_daily_status (branch_id, date, is_puno, puno_reported_at)
      VALUES ($1, CURRENT_DATE, true, NOW())
      ON CONFLICT (branch_id, date) DO UPDATE SET is_puno = true, puno_reported_at = NOW()
    `, [id]);
    return res.json({ confirmed: true });
  }

  // Log request (using anomaly_flags as placeholder or a dedicated table)
  await pool.query(`
    INSERT INTO anomaly_flags (branch_id, flag_type, trigger_count) 
    VALUES ($1, 'PUNO_REPORT_' || $2, 1)
    ON CONFLICT (branch_id, flag_type) DO UPDATE SET
      created_at = NOW()
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

  // SECURITY: Require minimum device trust score before accepting non-demo requirement reports.
  if (!DEMO_MODE) {
    const devRes = await pool.query(
      `SELECT trust_score FROM device_trust WHERE device_hash = $1`,
      [device_hash]
    );
    const trust = Number(devRes.rows[0]?.trust_score ?? 0);
    if (trust < anomalyConfig.manualEligibleTrustScoreMin) {
      return res.status(403).json({ success: false, error: 'NOT_CREDIBLE' });
    }
  }

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
  console.log(`Server running on port ${PORT}`);
});
