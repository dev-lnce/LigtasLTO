// SECURITY: Consolidated anomaly/risk engine for gaps 1..14.
// Prevents fixes from bypassing detection by centralizing all server-side logic here.

const crypto = require('crypto');

const anomalyConfig = require('../config/anomaly.js');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function extractIp(req) {
  // Prefer x-forwarded-for when behind a proxy; otherwise fall back to req.ip.
  const xff = req?.headers?.['x-forwarded-for'];
  const ip = typeof xff === 'string' && xff.length > 0 ? xff.split(',')[0].trim() : req?.ip;
  if (!ip) return null;
  // Handle IPv6-mapped or raw: try to find the first IPv4 pattern.
  const m = ip.match(/(\d{1,3}\.){3}\d{1,3}/);
  return m ? m[0] : null;
}

function ipSubnetFirst3(ipV4) {
  if (!ipV4) return '0.0.0';
  const parts = ipV4.split('.');
  if (parts.length < 3) return '0.0.0';
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function gpsCluster3Decimals(lat, lng) {
  const rlat = Number(lat).toFixed(3);
  const rlng = Number(lng).toFixed(3);
  return `${rlat},${rlng}`;
}

function effectiveWeightMultiplier({ submissionConfidence, lowConfidencePeriod, lowConfidenceWeightMultiplier }) {
  // Gap 4 + Gap 7: low-confidence submissions are weighted at 50% in averages.
  const isLow = submissionConfidence === 'low' || lowConfidencePeriod === true;
  return isLow ? lowConfidenceWeightMultiplier : 1.0;
}

function milestoneLabels() {
  return {
    // SECURITY FIX: The UI and earlier scenario code used different milestone label strings.
    // We accept both variants so milestone completion signals/STS bonuses keep working.
    evaluation: ['Evaluation Done', 'Tinanggap na ang papel ko sa unang window,'],
    photo: ['Photo/Biometrics Done', 'Kinunan na ako ng litrato at fingerprint,'],
    cashier: ['Paid Cashier', 'Nabayaran na ko sa cashier window,'],
    release: ['Received ID/Papers', 'Nakuha ko na ang aking ID o resibo.', 'Tapos Na'],
  };
}

function parseMilestones(milestones) {
  const ms = safeArray(milestones);
  // Frontend sends [{ milestone: 'Evaluation Done', completed_at: '...' }, ...]
  const map = {};
  for (const item of ms) {
    if (!item || typeof item !== 'object') continue;
    const label = item.milestone;
    const completedAt = item.completed_at;
    if (typeof label === 'string' && typeof completedAt === 'string') {
      map[label] = new Date(completedAt);
    }
  }
  return map;
}

function getMilestoneTiming(milestones) {
  const labels = milestoneLabels();
  const map = parseMilestones(milestones);
  const pickFirst = (arr) => arr.map((k) => map[k]).find(Boolean) || null;

  const evaluationAt = pickFirst(labels.evaluation);
  const photoAt = pickFirst(labels.photo);
  const cashierAt = pickFirst(labels.cashier);
  const releaseAt = pickFirst(labels.release);

  const allComplete = Boolean(evaluationAt && photoAt && cashierAt && releaseAt);
  const times = [evaluationAt, photoAt, cashierAt, releaseAt].filter(Boolean).map((d) => d.getTime());
  const earliest = times.length ? Math.min(...times) : null;
  const latest = times.length ? Math.max(...times) : null;
  const totalRushMinutes = earliest && latest ? (latest - earliest) / 60000 : null;

  return {
    evaluationAt,
    photoAt,
    cashierAt,
    releaseAt,
    allComplete,
    earliestAt: earliest ? new Date(earliest).toISOString() : null,
    latestAt: latest ? new Date(latest).toISOString() : null,
    totalRushMinutes,
  };
}

function computeCv(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return mean === 0 ? null : sd / mean;
}

function getEffectiveThresholds() {
  // Gap 6: jitter every numeric threshold on each evaluation.
  const jittered = (base) => anomalyConfig.applyJitter(base);
  return {
    speedThresholdPercent: jittered(anomalyConfig.speedThresholdPercent),
    clusterSize: Math.max(1, Math.floor(jittered(anomalyConfig.clusterSize))),
    clusterWindowMinutes: Math.max(1, Math.floor(jittered(anomalyConfig.clusterWindowMinutes))),
    manualReportThreshold: Math.max(1, Math.floor(jittered(anomalyConfig.manualReportThreshold))),

    geofenceStartRadiusMeters: jittered(anomalyConfig.geofenceStartRadiusMeters),
    geofenceSubmitRadiusMeters: jittered(anomalyConfig.geofenceSubmitRadiusMeters),
    geofenceRejectRadiusMeters: jittered(anomalyConfig.geofenceRejectRadiusMeters),

    passiveCandidateUnderFactor: jittered(anomalyConfig.passiveCandidateUnderFactor),

    silentAbandonHours: Math.max(1, Math.floor(jittered(anomalyConfig.silentAbandonHours))),

    sabotageClusterSize: Math.max(5, Math.floor(jittered(anomalyConfig.sabotageClusterSize))),
    sabotageClusterWindowMinutes: Math.max(30, Math.floor(jittered(anomalyConfig.sabotageClusterWindowMinutes))),
    sabotageClusterRadiusMeters: Math.max(10, jittered(anomalyConfig.sabotageClusterRadiusMeters)),

    highVelocityDeviceLimitCount: Math.max(1, Math.floor(jittered(anomalyConfig.highVelocityDeviceLimitCount))),
    highVelocityDeviceLimitWindowHours: Math.max(1, Math.floor(jittered(anomalyConfig.highVelocityDeviceLimitWindowHours))),

    compositeMatchMinComponents: Math.max(3, Math.floor(jittered(anomalyConfig.compositeMatchMinComponents))),

    lowConfidenceHourCutoff: Math.max(0, Math.floor(jittered(anomalyConfig.lowConfidenceHourCutoff))),
    lowConfidenceMinDayCount: Math.max(1, Math.floor(jittered(anomalyConfig.lowConfidenceMinDayCount))),
    lowConfidenceWeightMultiplier: jittered(anomalyConfig.lowConfidenceWeightMultiplier),

    manualEligibleTrustScoreMin: Math.max(0, Math.floor(jittered(anomalyConfig.manualEligibleTrustScoreMin))),
    manualEligiblePriorSubmissionsMin: Math.max(1, Math.floor(jittered(anomalyConfig.manualEligiblePriorSubmissionsMin))),

    queueMismatchRatioDayAppointmentThreshold: jittered(anomalyConfig.queueMismatchRatioDayAppointmentThreshold),
    nationalAppointmentUtilizationThreshold: jittered(anomalyConfig.nationalAppointmentUtilizationThreshold),

    roundNumberModuloSeconds: Math.max(60, Math.floor(jittered(anomalyConfig.roundNumberModuloSeconds))),
    interSubmissionCvThreshold: jittered(anomalyConfig.interSubmissionCvThreshold),
    milestoneRushingMinutes: Math.max(1, Math.floor(jittered(anomalyConfig.milestoneRushingMinutes))),
    milestoneTotalRushMinutes: Math.max(1, Math.floor(jittered(anomalyConfig.milestoneTotalRushMinutes))),

    coordinateClusterDistanceMeters: Math.max(10, jittered(anomalyConfig.coordinateClusterDistanceMeters)),
  };
}

function haversineMetersSql(latCol, lngCol, latParam, lngParam) {
  // SECURITY: Server-side distance check prevents clients from spoofing geofence results.
  // Uses the haversine formula.
  return `
    6371000 * 2 * ASIN(
      SQRT(
        POWER(SIN(RADIANS(${latParam} - ${latCol}) / 2), 2) +
        COS(RADIANS(${latCol})) * COS(RADIANS(${latParam})) *
        POWER(SIN(RADIANS(${lngParam} - ${lngCol}) / 2), 2)
      )
    )
  `;
}

module.exports = function createAnomalyEngine(pool) {
  async function resolveDevice(req, payloadGpsLat, payloadGpsLng, fpBrowserHash) {
    const DEMO_MODE = process.env.DEMO_MODE === 'true';
    const ip = extractIp(req);
    const ipSubnet = ipSubnetFirst3(ip);
    const gpsCluster = gpsCluster3Decimals(payloadGpsLat, payloadGpsLng);

    // Gap 3: fp_timing_hash computed from recent submission intervals in the same GPS cluster.
    // SECURITY: Works even if browser fingerprint changes (incognito/cache clear).
    const timingHash = await (async () => {
      if (DEMO_MODE) return sha256Hex('demo-timing');
      const res = await pool.query(
        `
          SELECT submitted_at
          FROM timer_submissions
          WHERE submitted_at >= NOW() - INTERVAL '7 days'
            AND ROUND(gps_lat::numeric, 3) = ROUND($1::numeric, 3)
            AND ROUND(gps_lng::numeric, 3) = ROUND($2::numeric, 3)
          ORDER BY submitted_at DESC
          LIMIT 8
        `,
        [payloadGpsLat, payloadGpsLng]
      );

      const times = res.rows
        .map((r) => (r.submitted_at ? new Date(r.submitted_at).getTime() : null))
        .filter(Boolean)
        .sort((a, b) => a - b);

      const deltas = [];
      for (let i = 1; i < times.length; i++) {
        deltas.push(Math.max(0, Math.round((times[i] - times[i - 1]) / 60000))); // minutes deltas
      }

      const base = `${deltas.join(',') || 'none'}`;
      return sha256Hex(base);
    })();

    if (DEMO_MODE) {
      const deviceHash = fpBrowserHash;
      await pool.query(
        `
          INSERT INTO device_trust (
            device_hash,
            fp_browser_hash,
            fp_ip_subnet,
            fp_gps_cluster,
            fp_timing_hash,
            submission_count_24h,
            high_velocity,
            trust_score,
            last_updated
          )
          VALUES ($1, $2, $3, $4, $5, 0, false, 100, NOW())
          ON CONFLICT (device_hash) DO UPDATE SET
            fp_ip_subnet = EXCLUDED.fp_ip_subnet,
            fp_gps_cluster = EXCLUDED.fp_gps_cluster,
            fp_timing_hash = EXCLUDED.fp_timing_hash,
            last_updated = NOW()
        `,
        [deviceHash, fpBrowserHash, ipSubnet, gpsCluster, timingHash]
      );
      return { deviceHash, components: { fpBrowserHash, ipSubnet, gpsCluster, timingHash } };
    }

    const compositeHash = sha256Hex([fpBrowserHash, ipSubnet, gpsCluster, timingHash].join('|'));

    // Gap 3: match when any 3 of 4 components match an existing record.
    const match = await pool.query(
      `
        SELECT device_hash
        FROM device_trust
        WHERE (
          (fp_browser_hash = $1)::int +
          (fp_ip_subnet = $2)::int +
          (fp_gps_cluster = $3)::int +
          (fp_timing_hash = $4)::int
        ) >= $5
        ORDER BY last_updated DESC
        LIMIT 1
      `,
      [fpBrowserHash, ipSubnet, gpsCluster, timingHash, anomalyConfig.compositeMatchMinComponents]
    );

    const resolved = match.rows[0]?.device_hash || compositeHash;

    // Upsert resolved device trust row.
    await pool.query(
      `
        INSERT INTO device_trust (
          device_hash, fp_browser_hash, fp_ip_subnet, fp_gps_cluster, fp_timing_hash,
          submission_count_24h, high_velocity, trust_score, multi_branch_reporter, last_updated
        )
        VALUES (
          $1, $2, $3, $4, $5,
          0, false, 1, false, NOW()
        )
        ON CONFLICT (device_hash) DO UPDATE SET
          fp_browser_hash = EXCLUDED.fp_browser_hash,
          fp_ip_subnet = EXCLUDED.fp_ip_subnet,
          fp_gps_cluster = EXCLUDED.fp_gps_cluster,
          fp_timing_hash = EXCLUDED.fp_timing_hash,
          last_updated = NOW()
      `,
      [resolved, fpBrowserHash, ipSubnet, gpsCluster, timingHash]
    );

    return { deviceHash: resolved, components: { fpBrowserHash, ipSubnet, gpsCluster, timingHash } };
  }

  async function evaluate(savedSubmission, device, branch) {
    // Evaluate after insertion; updates the saved record fields (within the route transaction).
    const thresholds = getEffectiveThresholds();

    const submissionId = savedSubmission.id;

    // Load full record context (avoids relying on caller computed fields).
    const recordRes = await pool.query(`SELECT * FROM timer_submissions WHERE id = $1`, [submissionId]);
    const record = recordRes.rows[0];

    // Gap 4: geofence validation on submitted GPS coordinates (150m submit radius; reject beyond 500m).
    const submissionLat = record.gps_lat;
    const submissionLng = record.gps_lng;

    const isDemo = process.env.DEMO_MODE === 'true';
    let submissionConfidence = record.submission_confidence || 'high';

    if (!isDemo) {
      const rejectDistanceMeters = thresholds.geofenceRejectRadiusMeters;
      const submitDistanceMeters = thresholds.geofenceSubmitRadiusMeters;

      const distMeters = await (async () => {
        const res = await pool.query(
          `
            SELECT
              6371000 * 2 * ASIN(
                SQRT(
                  POWER(SIN(RADIANS($1 - b.lat) / 2), 2) +
                  COS(RADIANS(b.lat)) * COS(RADIANS($1)) *
                  POWER(SIN(RADIANS($2 - b.lng) / 2), 2)
                )
              ) AS meters
            FROM branches b
            WHERE b.id = $3
          `,
          [submissionLat, submissionLng, record.branch_id]
        );
        return Number(res.rows[0]?.meters || 0);
      })();

      if (distMeters > rejectDistanceMeters) {
        const err = new Error('LOCATION_TOO_FAR');
        err.statusCode = 422;
        err.payload = {
          error: 'LOCATION_TOO_FAR',
          message: 'Kailangan mong nasa malapit sa branch para mag-submit.',
        };
        throw err;
      }

      if (distMeters > submitDistanceMeters) submissionConfidence = 'low';
    }

    // Gap 7 cold-start baseline: mark submissions before 9AM when day count is < threshold.
    const submittedAt = record.submitted_at || new Date();
    const submittedHour = new Date(submittedAt).getHours();
    const dayCountRes = await pool.query(
      `
        SELECT COUNT(*)::int AS cnt
        FROM timer_submissions
        WHERE branch_id = $1 AND DATE(submitted_at) = CURRENT_DATE
      `,
      [record.branch_id]
    );
    const dayCount = Number(dayCountRes.rows[0]?.cnt || 0);
    const lowConfidencePeriod = !isDemo && submittedHour < thresholds.lowConfidenceHourCutoff && dayCount < thresholds.lowConfidenceMinDayCount;

    // Gap 9 queue type cross-validation.
    const queueType = record.queue_type || 'walk-in';
    const queueNumber = record.queue_number || '';
    const prefixMatch = String(queueNumber).toUpperCase().match(/[A-Z]/);
    const detectedPrefix = prefixMatch ? prefixMatch[0] : null;

    let queueTypeMismatch = false;
    let effectiveQueuePoolType = queueType;

    if (!isDemo && detectedPrefix) {
      // Learn/refine prefix patterns over time.
      const existingPattern = await pool.query(
        `
          SELECT typical_queue_type
          FROM queue_prefix_patterns
          WHERE branch_id = $1 AND prefix = $2
          LIMIT 1
        `,
        [record.branch_id, detectedPrefix]
      );

      if (existingPattern.rows[0]) {
        const typical = existingPattern.rows[0].typical_queue_type;
        if (queueType === 'appointment' && typical === 'walk-in') {
          queueTypeMismatch = true;
          effectiveQueuePoolType = 'walk-in';
        }
      } else {
        // Initial learning.
        await pool.query(
          `
            INSERT INTO queue_prefix_patterns (branch_id, prefix, typical_queue_type, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (branch_id, prefix) DO UPDATE SET typical_queue_type = EXCLUDED.typical_queue_type, updated_at = NOW()
          `,
          [record.branch_id, detectedPrefix, queueType === 'appointment' ? 'appointment' : 'walk-in']
        );
      }

      // Keep refining typical type based on recent submissions.
      await pool.query(
        `
          INSERT INTO queue_prefix_patterns (branch_id, prefix, typical_queue_type, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (branch_id, prefix) DO UPDATE SET
            typical_queue_type = EXCLUDED.typical_queue_type,
            updated_at = NOW()
        `,
        [record.branch_id, detectedPrefix, queueTypeMismatch ? 'walk-in' : (queueType === 'appointment' ? 'appointment' : 'walk-in')]
      );
    }

    // Gap 9: anomalous appointment ratio (daily).
    let anomalousAppointmentRatio = false;
    if (!isDemo) {
      const apptTodayRes = await pool.query(
        `
          SELECT
            SUM(CASE WHEN queue_type = 'appointment' AND NOT queue_type_mismatch THEN 1 ELSE 0 END)::int AS appt_cnt,
            COUNT(*)::int AS total_cnt
          FROM timer_submissions
          WHERE branch_id = $1
            AND DATE(submitted_at) = CURRENT_DATE
        `,
        [record.branch_id]
      );
      const apptCnt = Number(apptTodayRes.rows[0]?.appt_cnt || 0);
      const totalCnt = Number(apptTodayRes.rows[0]?.total_cnt || 0);

      if (totalCnt >= 10) {
        const branchApptRatio = totalCnt ? apptCnt / totalCnt : 0;

        const nationalRes = await pool.query(
          `
            SELECT
              SUM(CASE WHEN queue_type = 'appointment' AND NOT queue_type_mismatch THEN 1 ELSE 0 END)::int AS appt_cnt,
              COUNT(*)::int AS total_cnt
            FROM timer_submissions
            WHERE DATE(submitted_at) = CURRENT_DATE
          `
        );
        const natAppt = Number(nationalRes.rows[0]?.appt_cnt || 0);
        const natTotal = Number(nationalRes.rows[0]?.total_cnt || 0);
        const natUtil = natTotal ? natAppt / natTotal : 0;

        anomalousAppointmentRatio = branchApptRatio >= thresholds.queueMismatchRatioDayAppointmentThreshold && natUtil < thresholds.nationalAppointmentUtilizationThreshold;
      }
    }

    // Gap 2: shadow ban sliding-window GPS cluster logic.
    let isShadowBanned = record.is_shadow_banned || false;

    if (!isShadowBanned) {
      // Query last N submissions within radius for this branch near the new submission coords.
      const recentClusterRes = await pool.query(
        `
          SELECT id, submitted_at
          FROM timer_submissions
          WHERE branch_id = $1
            AND gps_lat IS NOT NULL AND gps_lng IS NOT NULL
            AND submitted_at >= NOW() - INTERVAL '24 hours'
            AND (
              6371000 * 2 * ASIN(
                SQRT(
                  POWER(SIN(RADIANS($2 - gps_lat) / 2), 2) +
                  COS(RADIANS(gps_lat)) * COS(RADIANS($2)) *
                  POWER(SIN(RADIANS($3 - gps_lng) / 2), 2)
                )
              )
            ) <= $4
          ORDER BY submitted_at DESC
          LIMIT $5
        `,
        [record.branch_id, submissionLat, submissionLng, thresholds.sabotageClusterRadiusMeters, thresholds.sabotageClusterSize]
      );

      const rows = recentClusterRes.rows;
      if (rows.length >= thresholds.sabotageClusterSize) {
        const sorted = [...rows].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
        const oldest = new Date(sorted[0].submitted_at).getTime();
        const newest = new Date(sorted[sorted.length - 1].submitted_at).getTime();
        const spanMinutes = (newest - oldest) / 60000;
        if (spanMinutes <= thresholds.sabotageClusterWindowMinutes) {
          isShadowBanned = true;
          await pool.query(`UPDATE timer_submissions SET is_shadow_banned = true WHERE id = ANY($1::uuid[])`, [[...rows].map((r) => r.id)]);
          await pool.query(
            `
              INSERT INTO suspicious_submissions (branch_id, device_hash, payload, flag_reason, detected_at)
              VALUES ($1, $2, $3, $4, NOW())
            `,
            [record.branch_id, record.device_hash, JSON.stringify(record), 'shadow_banned_cluster_fast_spam']
          );
        }
      }
    }

    // Gap 2: high-velocity device across any branch.
    if (device?.deviceHash) {
      const hvRes = await pool.query(
        `
          SELECT COUNT(*)::int AS cnt
          FROM timer_submissions
          WHERE device_hash = $1
            AND submitted_at >= NOW() - INTERVAL '24 hours'
        `,
        [device.deviceHash]
      );
      const hvCount = Number(hvRes.rows[0]?.cnt || 0);
      const highVelocity = hvCount > thresholds.highVelocityDeviceLimitCount;

      if (highVelocity) {
        await pool.query(`UPDATE device_trust SET high_velocity = true, submission_count_24h = $2, last_updated = NOW() WHERE device_hash = $1`, [device.deviceHash, hvCount]);
      } else {
        await pool.query(`UPDATE device_trust SET submission_count_24h = $2, last_updated = NOW() WHERE device_hash = $1`, [device.deviceHash, hvCount]);
      }
    }

    // Re-load device trust for weighting/STC.
    const devTrustRes = await pool.query(
      `SELECT * FROM device_trust WHERE device_hash = $1`,
      [device.deviceHash]
    );
    const devTrust = devTrustRes.rows[0] || null;

    const highVelocity = Boolean(devTrust?.high_velocity);

    // Gap 11: behavioral consistency scoring and submission_weight.
    const waitSeconds = Number(record.wait_time_seconds || 0);
    const behavioralFlags = [];

    if (thresholds.roundNumberModuloSeconds > 0 && waitSeconds > 0 && waitSeconds % thresholds.roundNumberModuloSeconds === 0) {
      behavioralFlags.push('round_wait_time');
    }

    // Evenly spaced submissions -> low CV of inter-submission intervals.
    if (device?.deviceHash) {
      const intervalsRes = await pool.query(
        `
          SELECT submitted_at
          FROM timer_submissions
          WHERE device_hash = $1
          ORDER BY submitted_at DESC
          LIMIT 7
        `,
        [device.deviceHash]
      );
      const times = intervalsRes.rows
        .map((r) => (r.submitted_at ? new Date(r.submitted_at).getTime() : null))
        .filter(Boolean)
        .sort((a, b) => a - b);
      if (times.length >= 4) {
        const deltasSec = [];
        for (let i = 1; i < times.length; i++) deltasSec.push((times[i] - times[i - 1]) / 1000);
        const cv = computeCv(deltasSec);
        if (cv !== null && cv < thresholds.interSubmissionCvThreshold) behavioralFlags.push('even_spacing');
      }
    }

    const ms = getMilestoneTiming(record.milestones);
    const milestoneAllComplete = ms.allComplete;

    // Milestone rushing within 5 minutes among all milestones.
    if (milestoneAllComplete && ms.totalRushMinutes !== null && ms.totalRushMinutes <= thresholds.milestoneRushingMinutes) {
      behavioralFlags.push('milestone_rushing');
    }

    // No queue slip photo => no 'photo' milestone tapped.
    const hasQueueSlipPhoto = Boolean(ms.photoAt);
    if (!hasQueueSlipPhoto) behavioralFlags.push('missing_queue_slip_photo');

    const flagCount = behavioralFlags.length;
    let baseWeight = anomalyConfig.behavioralWeightByFlagCount[flagCount] ?? anomalyConfig.behavioralWeightByFlagCount.default;
    if (!Number.isFinite(baseWeight)) baseWeight = 1.0;

    // Gap 2/11: high-velocity devices weighted at 20% in averages.
    const submissionWeight = highVelocity ? baseWeight * anomalyConfig.highVelocityWeightMultiplier : baseWeight;

    // Gap 12: speed signal/outlier decision uses Tier1 baseline.
    // Reference rolling mean from branch_rolling_stats (Gap 7).
    const dow = submittedAt.getDay(); // 0..6
    let rollingAvgTrimmed = null;
    let rollingStd = null;

    const rollingRes = await pool.query(
      `
        SELECT walkin_trimmed_mean_seconds::float AS trimmed_mean
        FROM branch_rolling_stats
        WHERE branch_id = $1 AND day_of_week = $2
        LIMIT 1
      `,
      [record.branch_id, dow]
    );
    rollingAvgTrimmed = rollingRes.rows[0]?.trimmed_mean ?? null;

    if (rollingAvgTrimmed === null) {
      // Fallback: compute from last 4 weeks walk-in only, excluding low_confidence_period and shadow/outlier.
      const fallback = await pool.query(
        `
          SELECT AVG(wait_time_seconds)::float AS avg_seconds
          FROM timer_submissions
          WHERE branch_id = $1
            AND submitted_at >= NOW() - INTERVAL '28 days'
            AND EXTRACT(DOW FROM submitted_at) = $2
            AND (queue_type = 'walk-in' OR queue_type_mismatch = true)
            AND NOT is_shadow_banned AND NOT is_outlier
            AND NOT low_confidence_period
        `,
        [record.branch_id, dow]
      );
      rollingAvgTrimmed = fallback.rows[0]?.avg_seconds ?? 0;
    }

    // outlier / speed signal based on rollingAvgTrimmed
    const effectiveSpeedThreshold = rollingAvgTrimmed * thresholds.speedThresholdPercent;
    const isLowConfidenceForTriggers = submissionConfidence === 'low' || lowConfidencePeriod;
    const speedSignal = !isLowConfidenceForTriggers && rollingAvgTrimmed > 0 && waitSeconds > 0 && waitSeconds < effectiveSpeedThreshold;

    // Gap 12 milestone signal (<8 minutes total).
    const milestoneSignal = !isLowConfidenceForTriggers && milestoneAllComplete && ms.totalRushMinutes !== null && ms.totalRushMinutes <= thresholds.milestoneTotalRushMinutes;

    // Gap 12 manual report signal: eligible manual fixer report exists within same 1-hour window.
    const manualSignal = !isLowConfidenceForTriggers
      ? (
          await pool.query(
            `
              SELECT COUNT(*)::int AS cnt
              FROM timer_submissions
              WHERE branch_id = $1
                AND submitted_at >= NOW() - INTERVAL '1 hour'
                AND anomaly_trigger_eligible = true
            `,
            [record.branch_id]
          )
        ).rows[0]?.cnt > 0
      : false;

    // Gap 12 queue-type mismatch signal: any submission in cluster has mismatch.
    const queueMismatchSignal = !isLowConfidenceForTriggers
      ? (
          await pool.query(
            `
              SELECT COUNT(*)::int AS cnt
              FROM timer_submissions
              WHERE branch_id = $1
                AND submitted_at >= NOW() - INTERVAL '1 hour'
                AND queue_type_mismatch = true
            `,
            [record.branch_id]
          )
        ).rows[0]?.cnt > 0
      : false;

    // Gap 12 coordinate cluster signal: 3+ submissions within 50m.
    const coordinateClusterSignal = !isLowConfidenceForTriggers
      ? (
          await pool.query(
            `
              SELECT COUNT(*)::int AS cnt
              FROM timer_submissions
              WHERE branch_id = $1
                AND submitted_at >= NOW() - INTERVAL '1 hour'
                AND gps_lat IS NOT NULL AND gps_lng IS NOT NULL
                AND (
                  6371000 * 2 * ASIN(
                    SQRT(
                      POWER(SIN(RADIANS($2 - gps_lat) / 2), 2) +
                      COS(RADIANS(gps_lat)) * COS(RADIANS($2)) *
                      POWER(SIN(RADIANS($3 - gps_lng) / 2), 2)
                    )
                  )
                ) <= $4
                AND NOT is_shadow_banned AND NOT is_outlier
                AND (submission_confidence <> 'low' AND NOT low_confidence_period)
            `,
            [record.branch_id, submissionLat, submissionLng, thresholds.coordinateClusterDistanceMeters]
          )
        ).rows[0]?.cnt >= thresholds.clusterSize
      : false;

    // Gap 5: manual report credibility gating.
    const userFlags = safeArray(record.user_flags);
    const isMayFixer = userFlags.includes('may_fixer');

    let anomalyTriggerEligible = false;
    if (isMayFixer && !isLowConfidenceForTriggers) {
      const priorRes = await pool.query(
        `
          SELECT COUNT(*)::int AS cnt
          FROM timer_submissions
          WHERE device_hash = $1
            AND id <> $2
        `,
        [device.deviceHash, record.id]
      );
      const priorCount = Number(priorRes.rows[0]?.cnt || 0);

      const eligibleTrust = Number(devTrust?.trust_score || 0) >= thresholds.manualEligibleTrustScoreMin;
      const eligibleMilestones = manualConfigAllMilestonesComplete(record.milestones);
      const eligiblePrior = priorCount >= thresholds.manualEligiblePriorSubmissionsMin;

      anomalyTriggerEligible = eligibleTrust && eligibleMilestones && eligiblePrior;

      if (!anomalyTriggerEligible) {
        // Pending review (excluded from anomaly calculations).
        await pool.query(
          `
            INSERT INTO pending_review (branch_id, device_hash, timer_submission_id, payload, reason, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (timer_submission_id) DO NOTHING
          `,
          [record.branch_id, device.deviceHash, record.id, JSON.stringify(record), 'manual_report_not_credible']
        );
      }
    }

    // Gap 5: multi-branch reporter escalation.
    if (isMayFixer && device?.deviceHash) {
      const mrRes = await pool.query(
        `
          SELECT COUNT(DISTINCT branch_id)::int AS distinct_branches
          FROM timer_submissions
          WHERE device_hash = $1
            AND submitted_at >= NOW() - INTERVAL '24 hours'
            AND user_flags @> '["may_fixer"]'::jsonb
        `,
        [device.deviceHash]
      );
      const distinctBranches = Number(mrRes.rows[0]?.distinct_branches || 0);
      if (distinctBranches >= 3) {
        await pool.query(
          `UPDATE device_trust SET multi_branch_reporter = true, last_updated = NOW() WHERE device_hash = $1`,
          [device.deviceHash]
        );
        await pool.query(
          `
            INSERT INTO pending_review (branch_id, device_hash, timer_submission_id, payload, reason, created_at)
            SELECT
              branch_id, device_hash, id, to_jsonb(ts), 'multi_branch_reporter_escalation', NOW()
            FROM timer_submissions ts
            WHERE device_hash = $1
              AND submitted_at >= NOW() - INTERVAL '24 hours'
              AND user_flags @> '["may_fixer"]'::jsonb
            ON CONFLICT (timer_submission_id) DO NOTHING
          `,
          [device.deviceHash]
        );

        // SECURITY: Ensure escalated multi-branch reports cannot contribute to anomaly triggers.
        await pool.query(
          `
            UPDATE timer_submissions
            SET anomaly_trigger_eligible = false
            WHERE device_hash = $1
              AND submitted_at >= NOW() - INTERVAL '24 hours'
              AND user_flags @> '["may_fixer"]'::jsonb
          `,
          [device.deviceHash]
        );
      }
    }

    // Gap 13 STS update (invisible weighting).
    // SECURITY: STS is stored server-side and never exposed to users.
    if (device?.deviceHash) {
      const existingTrust = Number(devTrust?.trust_score || (process.env.DEMO_MODE === 'true' ? 100 : 1));

      const milestoneComplete = milestoneAllComplete ? 1 : 0;
      const queueSlipPhoto = hasQueueSlipPhoto ? 1 : 0;

      // Statistically normal: within 1 standard deviation of rolling mean.
      // Approximate stddev from last 4 weeks walk-in data.
      let sd = null;
      if (rollingAvgTrimmed !== null && rollingAvgTrimmed > 0) {
        const sdRes = await pool.query(
          `
            SELECT STDDEV_POP(wait_time_seconds)::float AS sd
            FROM timer_submissions
            WHERE branch_id = $1
              AND submitted_at >= NOW() - INTERVAL '28 days'
              AND EXTRACT(DOW FROM submitted_at) = $2
              AND (queue_type = 'walk-in' OR queue_type_mismatch = true)
              AND NOT is_shadow_banned AND NOT is_outlier
              AND NOT low_confidence_period
          `,
          [record.branch_id, dow]
        );
        sd = sdRes.rows[0]?.sd ?? null;
      }
      const withinStd = sd && Number.isFinite(sd) && sd > 0 ? Math.abs(waitSeconds - rollingAvgTrimmed) <= sd : false;

      const milestoneRushed = behavioralFlags.includes('milestone_rushing');

      let nextTrust = existingTrust;
      if (milestoneComplete) nextTrust += anomalyConfig.stsBonusMilestoneComplete;
      if (withinStd) nextTrust += anomalyConfig.stsBonusStatisticallyNormal;
      if (queueSlipPhoto) nextTrust += anomalyConfig.stsBonusQueueSlipPhoto;

      if (speedSignal) nextTrust += anomalyConfig.stsPenaltyOutlier; // treat speed-signal as outlier proxy
      if (isShadowBanned) nextTrust += anomalyConfig.stsPenaltyShadowBanned;
      if (milestoneRushed) nextTrust += anomalyConfig.stsPenaltyMilestoneRushed;

      nextTrust = clamp(Math.round(nextTrust), 0, 100);

      await pool.query(
        `
          UPDATE device_trust
          SET trust_score = $2, last_updated = NOW()
          WHERE device_hash = $1
        `,
        [device.deviceHash, nextTrust]
      );
    }

    // Gap 12/13: compound signal requirement and weighted report threshold.
    let signalCount = 0;
    const signalTypes = [];
    if (speedSignal) { signalCount++; signalTypes.push('speed_signal'); }
    if (milestoneSignal) { signalCount++; signalTypes.push('milestone_signal'); }
    if (manualSignal) { signalCount++; signalTypes.push('manual_report_signal'); }
    if (queueMismatchSignal) { signalCount++; signalTypes.push('queue_type_mismatch_signal'); }
    if (coordinateClusterSignal) { signalCount++; signalTypes.push('coordinate_cluster_signal'); }

    const eligibleWeightedReports = await (async () => {
      // Weighted report count across devices in last hour (excluding low-confidence triggers).
      const res = await pool.query(
        `
          SELECT SUM(
            LEAST(1.0, (dt.trust_score::float / ${anomalyConfig.stsTrustWeightDivisor}))::float
          )::float AS weighted
          FROM timer_submissions ts
          JOIN device_trust dt ON dt.device_hash = ts.device_hash
          WHERE ts.branch_id = $1
            AND ts.submitted_at >= NOW() - INTERVAL '1 hour'
            AND ts.submission_confidence <> 'low'
            AND NOT ts.low_confidence_period
            AND (ts.is_shadow_banned = false AND ts.is_outlier = false)
        `,
        [record.branch_id]
      );
      return Number(res.rows[0]?.weighted || 0);
    })();

    const weightedThresholdMet = eligibleWeightedReports >= thresholds.manualReportThreshold;

    const effectiveAnomalyTrigger = signalCount >= 2 && weightedThresholdMet;

    // Update timer_submissions record fields.
    await pool.query(
      `
        UPDATE timer_submissions
        SET
          submission_confidence = $2,
          low_confidence_period = $3,
          queue_type_mismatch = $4,
          anomalous_appointment_ratio = $5,
          is_shadow_banned = $6,
          is_outlier = $7,
          is_passive_anomaly_candidate = CASE
            WHEN $8 THEN true ELSE false END,
          submission_weight = $9,
          behavioral_consistency_score = $10,
          anomaly_trigger_eligible = $11
        WHERE id = $1
      `,
      [
        record.id,
        submissionConfidence,
        lowConfidencePeriod,
        queueTypeMismatch,
        anomalousAppointmentRatio,
        isShadowBanned,
        speedSignal, // proxy outlier flag; used only for STS penalties and exclusion in stats
        !isLowConfidenceForTriggers && rollingAvgTrimmed > 0 && waitSeconds < rollingAvgTrimmed * thresholds.passiveCandidateUnderFactor,
        submissionWeight,
        flagCount,
        anomalyTriggerEligible,
      ]
    );

    // Gap 1: silent abandon count + passive anomaly candidate stored in branch_daily_stats view.
    // Gap 1 doesn't require an insert here; branch_daily_stats view computes it.

    // Gap 12/13: write anomaly flag if compound signals met.
    if (effectiveAnomalyTrigger) {
      await pool.query(
        `
          INSERT INTO anomaly_flags (branch_id, flag_type, trigger_count, signal_count, signal_types, created_at)
          VALUES ($1, 'fixer_activity', 1, $2, $3, NOW())
          ON CONFLICT (branch_id, flag_type) DO UPDATE SET
            trigger_count = anomaly_flags.trigger_count + 1,
            signal_count = EXCLUDED.signal_count,
            signal_types = EXCLUDED.signal_types,
            created_at = NOW()
        `,
        [record.branch_id, signalCount, signalTypes]
      );
    }

    // Gap 8: compute avg_full/avg_trimmed for integrity warning.
    const avgRes = await pool.query(
      `
        WITH eligible AS (
          SELECT
            ts.wait_time_seconds,
            (ts.submission_weight::float *
              CASE WHEN ts.submission_confidence = 'low' OR ts.low_confidence_period THEN $4 ELSE 1 END
            ) AS w
          FROM timer_submissions ts
          WHERE ts.branch_id = $1
            AND DATE(ts.submitted_at) = CURRENT_DATE
            AND NOT ts.is_shadow_banned AND NOT ts.is_outlier
            AND ts.wait_time_seconds IS NOT NULL
        ),
        bounds AS (
          SELECT
            percentile_cont(0.1) WITHIN GROUP (ORDER BY wait_time_seconds) AS p10,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY wait_time_seconds) AS p90
          FROM eligible
        )
        SELECT
          CASE WHEN COUNT(*) = 0 THEN NULL ELSE SUM(wait_time_seconds * w) / NULLIF(SUM(w),0) END AS avg_full,
          CASE
            WHEN (SELECT COUNT(*) FROM eligible) = 0 THEN NULL
            ELSE
              SUM(CASE WHEN wait_time_seconds >= bounds.p10 AND wait_time_seconds <= bounds.p90 THEN wait_time_seconds * w ELSE 0 END)
              / NULLIF(SUM(CASE WHEN wait_time_seconds >= bounds.p10 AND wait_time_seconds <= bounds.p90 THEN w ELSE 0 END), 0)
          END AS avg_trimmed
        FROM eligible, bounds
      `,
      [record.branch_id, record.id, record.device_hash, thresholds.lowConfidenceWeightMultiplier]
    );

    const avg_full = avgRes.rows[0]?.avg_full ?? null;
    const avg_trimmed = avgRes.rows[0]?.avg_trimmed ?? null;
    const avg_divergence_percent =
      avg_full && avg_trimmed ? Math.round(Math.abs(avg_full - avg_trimmed) / Math.max(1e-9, avg_trimmed) * 100) : null;

    const data_integrity_warning = avg_divergence_percent !== null && avg_divergence_percent > 40;

    return {
      success: true,
      is_shadow_banned: isShadowBanned,
      is_outlier: speedSignal,
      final_wait_seconds: waitSeconds,
      submission_confidence: submissionConfidence,
      low_confidence_period: lowConfidencePeriod,
      queue_type_mismatch: queueTypeMismatch,
      anomalous_appointment_ratio: anomalousAppointmentRatio,
      avg_full,
      avg_trimmed,
      avg_divergence_percent,
      data_integrity_warning,
    };
  }

  // SECURITY: Single source for "all 4 milestones completed" checks.
  function manualConfigAllMilestonesComplete(milestones) {
    const labels = milestoneLabels();
    const map = parseMilestones(milestones);
    const hasAny = (arr) => arr.some((k) => Boolean(map[k]));
    return Boolean(hasAny(labels.evaluation) && hasAny(labels.photo) && hasAny(labels.cashier) && hasAny(labels.release));
  }

  // Gap 7/8/13/2 nightly maintenance.
  async function runNightlyMaintenance() {
    const client = pool;
    const now = new Date();

    // Gap 7: recalc branch_rolling_stats (Tier 1).
    await client.query(
      `
        DELETE FROM branch_rolling_stats;
      `
    );

    // Compute walk-in trimmed mean (remove top/bottom 10%) for each branch and day_of_week from last 4 weeks.
    // SECURITY: Excludes shadow-banned/outlier and low_confidence_period to prevent baseline poisoning.
    await client.query(
      `
        INSERT INTO branch_rolling_stats (
          branch_id, day_of_week,
          walkin_trimmed_mean_seconds, walkin_p25_seconds, walkin_p75_seconds,
          sample_size, last_updated
        )
        SELECT
          t.branch_id,
          t.day_of_week,
          (SUM(t.wait_time_seconds * t.w) / NULLIF(SUM(t.w),0))::int AS walkin_trimmed_mean_seconds,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY t.wait_time_seconds) AS walkin_p25_seconds,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY t.wait_time_seconds) AS walkin_p75_seconds,
          COUNT(*)::int AS sample_size,
          NOW() AS last_updated
        FROM (
          WITH ranked AS (
            SELECT
              ts.branch_id,
              EXTRACT(DOW FROM ts.submitted_at)::int AS day_of_week,
              ts.wait_time_seconds,
              (ts.submission_weight::float *
                CASE WHEN ts.submission_confidence = 'low' OR ts.low_confidence_period THEN $1 ELSE 1 END
              ) AS w,
              PERCENT_RANK() OVER (
                PARTITION BY ts.branch_id, EXTRACT(DOW FROM ts.submitted_at)
                ORDER BY ts.wait_time_seconds
              ) AS pr
            FROM timer_submissions ts
            WHERE ts.submitted_at >= NOW() - INTERVAL '28 days'
              AND NOT ts.is_shadow_banned AND NOT ts.is_outlier
              AND NOT ts.low_confidence_period
              AND (ts.queue_type = 'walk-in' OR ts.queue_type_mismatch = true)
              AND ts.wait_time_seconds IS NOT NULL
          )
          SELECT *
          FROM ranked
          WHERE pr >= 0.10 AND pr <= 0.90
        ) t
        GROUP BY t.branch_id, t.day_of_week;
      `,
      [anomalyConfig.lowConfidenceWeightMultiplier]
    );

    // Gap 8: drift detection (compare trimmed mean this week vs 4 weeks ago).
    // SECURITY: Flags possible baseline manipulation when meaningful drift happens without corroborating events.
    await client.query(
      `
        UPDATE branches b
        SET drift_alert = false
      `
    );

    // Compute means for current week and week 4 weeks ago per branch and compare.
    const driftRes = await client.query(
      `
        WITH this_week AS (
          SELECT
            ts.branch_id,
            AVG(ts.wait_time_seconds)::float AS trimmed_mean
          FROM timer_submissions ts
          WHERE ts.submitted_at >= NOW() - INTERVAL '7 days'
            AND ts.submitted_at < NOW()
            AND NOT ts.is_shadow_banned AND NOT ts.is_outlier
            AND NOT ts.low_confidence_period
            AND (ts.queue_type = 'walk-in' OR ts.queue_type_mismatch = true)
          GROUP BY ts.branch_id
        ),
        four_weeks_ago AS (
          SELECT
            ts.branch_id,
            AVG(ts.wait_time_seconds)::float AS trimmed_mean
          FROM timer_submissions ts
          WHERE ts.submitted_at >= NOW() - INTERVAL '35 days'
            AND ts.submitted_at < NOW() - INTERVAL '28 days'
            AND NOT ts.is_shadow_banned AND NOT ts.is_outlier
            AND NOT ts.low_confidence_period
            AND (ts.queue_type = 'walk-in' OR ts.queue_type_mismatch = true)
          GROUP BY ts.branch_id
        )
        SELECT
          tw.branch_id,
          tw.trimmed_mean AS this_trimmed_mean,
          fw.trimmed_mean AS four_trimmed_mean
        FROM this_week tw
        JOIN four_weeks_ago fw ON fw.branch_id = tw.branch_id
        WHERE fw.trimmed_mean > 0
          AND tw.trimmed_mean < fw.trimmed_mean * 0.80
      `
    );

    for (const row of driftRes.rows) {
      await client.query(`UPDATE branches SET drift_alert = true WHERE id = $1`, [row.branch_id]);
    }

    // Gap 2: expiry/recalc 24h device submission counts and high_velocity flags.
    await client.query(
      `
        UPDATE device_trust dt
        SET
          submission_count_24h = (
            SELECT COUNT(*)::int
            FROM timer_submissions ts
            WHERE ts.device_hash = dt.device_hash
              AND ts.submitted_at >= NOW() - INTERVAL '24 hours'
          ),
          high_velocity = (
            SELECT CASE
              WHEN COUNT(*) > $1 THEN true ELSE false
            END
            FROM timer_submissions ts
            WHERE ts.device_hash = dt.device_hash
              AND ts.submitted_at >= NOW() - INTERVAL '24 hours'
          ),
          last_updated = NOW()
      `,
      [anomalyConfig.highVelocityDeviceLimitCount]
    );
  }

  return {
    resolveDevice,
    evaluate,
    runNightlyMaintenance,
  };
};

