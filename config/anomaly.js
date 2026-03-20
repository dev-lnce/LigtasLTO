// SECURITY: Centralize anomaly/risk thresholds in one env-driven module.
// Prevents attackers from learning exact trigger thresholds by reading code.

function toFloat(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Gap 6 (base thresholds; effective thresholds are jittered per evaluation in anomalyEngine).
const speedThresholdPercent = toFloat(process.env.ANOMALY_SPEED_THRESHOLD, 0.25); // Gap 12 speed signal
const clusterSize = toInt(process.env.ANOMALY_CLUSTER_SIZE, 3); // Gap 12 coordinate-cluster count
const clusterWindowMinutes = toInt(process.env.ANOMALY_CLUSTER_WINDOW, 30); // Gap 12 signal window
const manualReportThreshold = toInt(process.env.ANOMALY_MANUAL_THRESHOLD, 2); // Gap 6/12 weighted report count baseline
const jitterPercent = toFloat(process.env.ANOMALY_JITTER, 0.15); // +/- jitter on every numeric threshold per evaluation

// Additional thresholds required by gaps 1..14.
// (All must be read from env so route handlers never hardcode trigger numbers.)
const geofenceStartRadiusMeters = toFloat(process.env.ANOMALY_GEOFENCE_START_RADIUS_M, 500);
const geofenceSubmitRadiusMeters = toFloat(process.env.ANOMALY_GEOFENCE_SUBMIT_RADIUS_M, 150);
const geofenceRejectRadiusMeters = toFloat(process.env.ANOMALY_GEOFENCE_REJECT_RADIUS_M, 500);

const passiveCandidateUnderFactor = toFloat(process.env.ANOMALY_PASSIVE_CANDIDATE_UNDER_FACTOR, 0.30); // Gap 1
const silentAbandonHours = toInt(process.env.ANOMALY_SILENT_ABANDON_HOURS, 3); // Gap 1

const sabotageClusterSize = toInt(process.env.ANOMALY_SABOTAGE_CLUSTER_SIZE, 20); // Gap 2
const sabotageClusterWindowMinutes = toInt(process.env.ANOMALY_SABOTAGE_CLUSTER_WINDOW_MINUTES, 180); // Gap 2 (3h)
const sabotageClusterRadiusMeters = toFloat(process.env.ANOMALY_SABOTAGE_CLUSTER_RADIUS_M, 100); // Gap 2

const highVelocityDeviceLimitCount = toInt(process.env.ANOMALY_HIGH_VELOCITY_LIMIT_COUNT, 4); // Gap 2
const highVelocityDeviceLimitWindowHours = toInt(process.env.ANOMALY_HIGH_VELOCITY_WINDOW_HOURS, 24); // Gap 2

const compositeMatchMinComponents = toInt(process.env.ANOMALY_COMPOSITE_MATCH_MIN_COMPONENTS, 3); // Gap 3

const lowConfidenceHourCutoff = toInt(process.env.ANOMALY_LOW_CONF_HOUR_CUTOFF, 9); // Gap 7 (before 9AM)
const lowConfidenceMinDayCount = toInt(process.env.ANOMALY_LOW_CONF_MIN_DAY_COUNT, 10); // Gap 7
const lowConfidenceWeightMultiplier = toFloat(process.env.ANOMALY_LOW_CONF_WEIGHT_MULTIPLIER, 0.50); // Gap 4/7

const manualEligibleTrustScoreMin = toInt(process.env.ANOMALY_MANUAL_ELIGIBLE_TRUST_MIN, 40); // Gap 5
const manualEligiblePriorSubmissionsMin = toInt(process.env.ANOMALY_MANUAL_ELIGIBLE_PRIOR_SUBMISSIONS_MIN, 2); // Gap 5
const manualAllMilestonesMustComplete = true; // Gap 5

const queueMismatchRatioDayAppointmentThreshold = toFloat(process.env.ANOMALY_QUEUE_MISMATCH_APPT_RATIO_THRESHOLD, 0.30); // Gap 9
const nationalAppointmentUtilizationThreshold = toFloat(process.env.ANOMALY_NATIONAL_APPT_UTILIZATION_THRESHOLD, 0.15); // Gap 9

// Gap 11 behavioral consistency scoring thresholds (red flag tests).
const roundNumberModuloSeconds = toInt(process.env.ANOMALY_ROUND_NUMBER_MODULO_SECONDS, 1800); // 30 minutes
const interSubmissionCvThreshold = toFloat(process.env.ANOMALY_INTER_SUBMISSION_CV_THRESHOLD, 0.20);
const milestoneRushingMinutes = toInt(process.env.ANOMALY_MILESTONE_RUSHING_MINUTES, 5);
const milestoneTotalRushMinutes = toInt(process.env.ANOMALY_MILESTONE_TOTAL_RUSH_MINUTES, 8);

// Gap 1..4..12 coordinate-cluster distance/weights.
const coordinateClusterDistanceMeters = toFloat(process.env.ANOMALY_COORDINATE_CLUSTER_DISTANCE_M, 50); // Gap 12

// Gap 13 STS penalties/bonuses.
const stsBonusMilestoneComplete = toInt(process.env.ANOMALY_STS_BONUS_MILESTONE_COMPLETE, 2);
const stsBonusStatisticallyNormal = toInt(process.env.ANOMALY_STS_BONUS_STAT_NORMAL, 1);
const stsBonusQueueSlipPhoto = toInt(process.env.ANOMALY_STS_BONUS_QUEUE_SLIP_PHOTO, 1);
const stsPenaltyOutlier = toInt(process.env.ANOMALY_STS_PENALTY_OUTLIER, -3);
const stsPenaltyShadowBanned = toInt(process.env.ANOMALY_STS_PENALTY_SHADOW_BANNED, -5);
const stsPenaltyMilestoneRushed = toInt(process.env.ANOMALY_STS_PENALTY_MILESTONE_RUSHED, -2);

// Gap 13: weight conversion from trust_score.
const stsTrustWeightCap = toFloat(process.env.ANOMALY_STS_TRUST_WEIGHT_CAP, 1.0);
const stsTrustWeightDivisor = toFloat(process.env.ANOMALY_STS_TRUST_WEIGHT_DIVISOR, 50); // signal_weight = min(1, trust_score/50)

// Gap 11: base weight schedule from red flags count.
const behavioralWeightByFlagCount = {
  0: toFloat(process.env.ANOMALY_BEHAVIOR_WEIGHT_FLAGS_0, 1.0),
  1: toFloat(process.env.ANOMALY_BEHAVIOR_WEIGHT_FLAGS_1, 0.7),
  2: toFloat(process.env.ANOMALY_BEHAVIOR_WEIGHT_FLAGS_2, 0.4),
  default: toFloat(process.env.ANOMALY_BEHAVIOR_WEIGHT_FLAGS_3_PLUS, 0.1),
};

// Gap 2/11: high-velocity multiplier (weighted at 20%).
const highVelocityWeightMultiplier = toFloat(process.env.ANOMALY_HIGH_VELOCITY_WEIGHT_MULTIPLIER, 0.20);

function applyJitter(base) {
  if (!Number.isFinite(base)) return base;
  // effective = base * (1 + (rand - 0.5) * 2 * jitterPercent)
  return base * (1 + (Math.random() - 0.5) * 2 * jitterPercent);
}

function getEffectiveThresholds() {
  // SECURITY: Jitter hides the exact trigger point from clients by randomizing per evaluation.
  // This prevents threshold-learning attacks.
  const out = {};
  for (const [k, v] of Object.entries(module.exports)) {
    if (typeof v === 'number') {
      out[k] = applyJitter(v);
    }
  }
  return out;
}

module.exports = {
  speedThresholdPercent,
  clusterSize,
  clusterWindowMinutes,
  manualReportThreshold,
  jitterPercent,

  geofenceStartRadiusMeters,
  geofenceSubmitRadiusMeters,
  geofenceRejectRadiusMeters,

  passiveCandidateUnderFactor,
  silentAbandonHours,

  sabotageClusterSize,
  sabotageClusterWindowMinutes,
  sabotageClusterRadiusMeters,

  highVelocityDeviceLimitCount,
  highVelocityDeviceLimitWindowHours,

  compositeMatchMinComponents,

  lowConfidenceHourCutoff,
  lowConfidenceMinDayCount,
  lowConfidenceWeightMultiplier,

  manualEligibleTrustScoreMin,
  manualEligiblePriorSubmissionsMin,
  manualAllMilestonesMustComplete,

  queueMismatchRatioDayAppointmentThreshold,
  nationalAppointmentUtilizationThreshold,

  roundNumberModuloSeconds,
  interSubmissionCvThreshold,
  milestoneRushingMinutes,
  milestoneTotalRushMinutes,

  coordinateClusterDistanceMeters,

  stsBonusMilestoneComplete,
  stsBonusStatisticallyNormal,
  stsBonusQueueSlipPhoto,
  stsPenaltyOutlier,
  stsPenaltyShadowBanned,
  stsPenaltyMilestoneRushed,

  stsTrustWeightCap,
  stsTrustWeightDivisor,

  behavioralWeightByFlagCount,
  highVelocityWeightMultiplier,

  applyJitter,
  getEffectiveThresholds,
};

