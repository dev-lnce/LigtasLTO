export type BranchGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type BranchStatusColor = 'green' | 'amber' | 'red';

export type BranchRequirementReport = {
  tag: string;
  labelFil: string;
  count: number;
  status: 'ok' | 'missing';
};
export type BranchRecentReport = {
  id: string;
  queuePrefix: string;
  transactionType: string;
  waitMinutes: number;
  isAnomaly?: boolean;
  createdAt: number;
};

export type Branch = {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  distanceKm: number;
  distance?: string;
  operatingHours: string;
  thumbnailUrl: string;

  // Live-ish status (mocked local data only)
  hasPlasticCards: boolean;
  grade: BranchGrade;
  reportsToday: number;
  is_puno: boolean;

  // Flags / alerts
  hasActiveAnomaly: boolean;
  anomalyDescription?: string;

  // SECURITY (Gap 8): server integrity uncertainty warning.
  data_integrity_warning?: boolean;
  avg_divergence_percent?: number;

  // Wait-time details
  walkinAvgMinutes: number;
  appointmentAvgMinutes: number;
  prequeueMinutesBeforeOpen?: number;

  // Community feed (past 7 days)
  communityRequirements7d: BranchRequirementReport[];

  // Recent reports log
  recentReports: BranchRecentReport[];

  // Herd warning (optional, backend-driven)
  high_demand_warning?: boolean;
  intentDistancesKmLast15m?: number[]; // distance from intents -> branch (km), used for arrival-time estimate

  // Decision widget helpers (optional, backend-driven)
  plastic_uncertain?: boolean;
  historical_puno_risk?: boolean;

  // Predictive morning estimates (optional, backend-driven)
  historical_estimates?: {
    walkin_morning_wait_minutes_by_dow?: Record<number, number[]>;
  };
};

export const BRANCHES: Branch[] = [
  {
    id: 'lto-diliman',
    name: 'LTO Diliman District',
    address: 'East Avenue, Quezon City',
    city: 'Quezon City, NCR',
    lat: 14.6436,
    lng: 121.045,
    distanceKm: 3.2,
    distance: "3.2",
    operatingHours: '08:00-17:00',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAt5TLnAull670qLVuHpgUZVwqv2F2JqTBZ9sFCxYStOGjzeTLB2wM4rBrxgHhk0u-VE1GrivY06S3eb1g9h8_-lhLy_XRjPhiYSlc65Vbr6KmyYC8IMVaAyHS2CIkZ9Tu6PZxOR2Xd8u2GjFUQbb-rJ65al_IeeI9H7Kt3CDO2SvaqutsU9gFSxZ0rEspDSNFZA9jM8t6UiyP13yzdFP4T-pJAumZNyOoAJkaEVM15JGYA5oik_2d2GLXjzoHqfn903ObiZb85i3X7',
    hasPlasticCards: true,
    grade: 'C',
    reportsToday: 42,
    is_puno: true,
    hasActiveAnomaly: true,
    anomalyDescription: 'May na-report na “fixer activity” sa labas ng gate.',
    walkinAvgMinutes: 200,
    appointmentAvgMinutes: 45,
    prequeueMinutesBeforeOpen: 45,
    communityRequirements7d: [
      { tag: 'Updated MedCert', labelFil: 'Na-update na MedCert', count: 12, status: 'missing' },
      { tag: 'Short bond only', labelFil: 'Short bond paper lamang', count: 5, status: 'ok' },
    ],
    historical_puno_risk: true,
    historical_estimates: {
      walkin_morning_wait_minutes_by_dow: {
        0: [210, 200, 220, 205, 215],
        1: [200, 190, 205, 195, 198],
        2: [215, 210, 225, 205, 220],
        3: [205, 198, 210, 200, 207],
        4: [220, 215, 230, 210, 225],
        5: [215, 210, 220, 205, 218],
        6: [225, 218, 235, 210, 228],
      },
    },
    recentReports: [
      { id: 'r1', queuePrefix: 'A', transactionType: 'License Renewal', waitMinutes: 215, isAnomaly: false, createdAt: Date.now() - 22 * 60 * 1000 },
      { id: 'r2', queuePrefix: 'B', transactionType: 'MV Registration', waitMinutes: 240, isAnomaly: true, createdAt: Date.now() - 2 * 60 * 60 * 1000 },
      { id: 'r3', queuePrefix: 'A', transactionType: 'New License', waitMinutes: 190, isAnomaly: false, createdAt: Date.now() - 4 * 60 * 60 * 1000 },
      { id: 'r4', queuePrefix: 'C', transactionType: 'Other', waitMinutes: 260, isAnomaly: false, createdAt: Date.now() - 6 * 60 * 60 * 1000 },
      { id: 'r5', queuePrefix: 'A', transactionType: 'License Renewal', waitMinutes: 175, isAnomaly: false, createdAt: Date.now() - 8 * 60 * 60 * 1000 },
    ],
  },
  {
    id: 'lto-novaliches',
    name: 'LTO Novaliches',
    address: 'Robinsons Novaliches, Quezon City',
    city: 'Quezon City, NCR',
    lat: 14.7216,
    lng: 121.0452,
    distanceKm: 8.7,
    distance: "8.7",
    operatingHours: '08:00-17:00',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDIVd2lrAYL1Qg54Pz7-Gt_TOD2GBPDKEIlDtl15TZEzlsW7sVg8EffwaNrQ-Uv7cS_mGrtChEILO-Siksfzkfm0FrUvUbi7j8CYMPV7-hYQxPi4ue_FPNgvNvMEj9kxIy0grVPAyj5ccUq0XegMJ0RH6G-kNM_D_OhMLMsDWrqulPE02c6MFePG_iymv38Ra69HV2wIJro8o6RTcyNYJh_XXSLGOUcGhyNlXI-EBkNmFsodhnj0N47lMbKQX6p3J520QdeyLJow7iG',
    hasPlasticCards: true,
    grade: 'A',
    reportsToday: 18,
    is_puno: false,
    hasActiveAnomaly: false,
    walkinAvgMinutes: 100,
    appointmentAvgMinutes: 20,
    prequeueMinutesBeforeOpen: 15,
    communityRequirements7d: [],
    plastic_uncertain: false,
    historical_puno_risk: false,
    historical_estimates: {
      walkin_morning_wait_minutes_by_dow: {
        0: [75, 70, 80, 78, 72],
        1: [70, 66, 74, 72, 68],
        2: [78, 74, 82, 76, 75],
        3: [72, 68, 76, 74, 70],
        4: [80, 76, 84, 78, 77],
        5: [76, 72, 80, 74, 71],
        6: [78, 75, 82, 76, 73],
      },
    },
    recentReports: [
      { id: 'r6', queuePrefix: 'N', transactionType: 'License Renewal', waitMinutes: 105, isAnomaly: false, createdAt: Date.now() - 18 * 60 * 1000 },
      { id: 'r7', queuePrefix: 'N', transactionType: 'MV Registration', waitMinutes: 95, isAnomaly: false, createdAt: Date.now() - 65 * 60 * 1000 },
      { id: 'r8', queuePrefix: 'N', transactionType: 'Other', waitMinutes: 120, isAnomaly: false, createdAt: Date.now() - 3 * 60 * 60 * 1000 },
    ],
  },
  {
    id: 'qc-licensing',
    name: 'QC Licensing Center',
    address: 'P. Tuazon Blvd, Cubao',
    city: 'Quezon City, NCR',
    lat: 14.6205,
    lng: 121.0521,
    distanceKm: 6.1,
    distance: "6.1",
    operatingHours: '08:00-17:00',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDIVd2lrAYL1Qg54Pz7-Gt_TOD2GBPDKEIlDtl15TZEzlsW7sVg8EffwaNrQ-Uv7cS_mGrtChEILO-Siksfzkfm0FrUvUbi7j8CYMPV7-hYQxPi4ue_FPNgvNvMEj9kxIy0grVPAyj5ccUq0XegMJ0RH6G-kNM_D_OhMLMsDWrqulPE02c6MFePG_iymv38Ra69HV2wIJro8o6RTcyNYJh_XXSLGOUcGhyNlXI-EBkNmFsodhnj0N47lMbKQX6p3J520QdeyLJow7iG',
    hasPlasticCards: true,
    grade: 'B',
    reportsToday: 27,
    is_puno: false,
    hasActiveAnomaly: false,
    anomalyDescription: 'May biglaang system downtime na na-report sa cashier.',
    walkinAvgMinutes: 140,
    appointmentAvgMinutes: 50,
    prequeueMinutesBeforeOpen: 30,
    communityRequirements7d: [
      { tag: 'Extra photocopy', labelFil: 'Dagdag na photocopy', count: 3, status: 'missing' },
    ],
    high_demand_warning: true,
    intentDistancesKmLast15m: [
      2.2, 2.0, 2.5, 2.1, 2.3, 2.4, 2.0, 2.6, 2.2, 2.1, 2.3, 2.4, 2.0, 2.6, 2.1, 2.2, 2.3, 2.4, 2.0,
      2.5, 2.2, 2.1,
    ], // ~22 intents
    plastic_uncertain: false,
    historical_puno_risk: false,
    historical_estimates: {
      walkin_morning_wait_minutes_by_dow: {
        0: [165, 160, 170, 155, 168],
        1: [160, 155, 165, 150, 158],
        2: [170, 165, 180, 160, 172],
        3: [162, 158, 168, 154, 160],
        4: [175, 170, 185, 165, 178],
        5: [168, 162, 175, 158, 166],
        6: [172, 165, 180, 160, 170],
      },
    },
    recentReports: [
      { id: 'r9', queuePrefix: 'Q', transactionType: 'License Renewal', waitMinutes: 150, isAnomaly: false, createdAt: Date.now() - 40 * 60 * 1000 },
      { id: 'r10', queuePrefix: 'Q', transactionType: 'New License', waitMinutes: 165, isAnomaly: true, createdAt: Date.now() - 90 * 60 * 1000 },
    ],
  },
];

export const getBranchesMock = async (): Promise<Branch[]> => {
  // SECURITY: Gap 10 - client-side display throttling via localStorage access tier.
  const ACCESS_KEY = 'ligtaslto_access_tier';
  const CACHE_KEY = 'ligtaslto_branches_cache';

  let tier = 1;
  let submissionCount = 0;
  let lastFetchedAt: number | null = null;

  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      submissionCount = parsed.submissionCount || 0;
      tier = submissionCount === 0 ? 1 : submissionCount <= 4 ? 2 : 3;
      lastFetchedAt = typeof parsed.lastFetchedAt === 'number' ? parsed.lastFetchedAt : null;
    }
  } catch {}

  const lagMs = tier === 1 ? 30 * 60 * 1000 : tier === 2 ? 10 * 60 * 1000 : 0;

  try {
    const cacheRaw = localStorage.getItem(CACHE_KEY);
    if (lagMs > 0 && cacheRaw && lastFetchedAt && Date.now() - lastFetchedAt < lagMs) {
      return JSON.parse(cacheRaw) as Branch[];
    }
  } catch {}

  // IMPROVEMENT 3: Mimic async fetch so screens can show skeleton loading states.
  await new Promise((r) => setTimeout(r, 650));

  const sorted = [...BRANCHES].sort((a, b) => {
    // SECURITY: Tier 1 sees distance-sorted only; Tier 2+ sees shortest-wait-sorted.
    if (tier === 1) return a.distanceKm - b.distanceKm;
    return a.walkinAvgMinutes - b.walkinAvgMinutes;
  });

  try {
    localStorage.setItem(
      ACCESS_KEY,
      JSON.stringify({
        tier,
        submissionCount,
        lastFetchedAt: Date.now(),
      })
    );
    localStorage.setItem(CACHE_KEY, JSON.stringify(sorted));
  } catch {}

  return sorted;
};

