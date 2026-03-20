export type BranchGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type BranchStatusColor = 'green' | 'amber' | 'red';

export type BranchRequirementReport = { tag: string; count: number };
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

  // Wait-time details
  walkinAvgMinutes: number;
  appointmentAvgMinutes: number;
  prequeueMinutesBeforeOpen?: number;

  // Community feed (past 7 days)
  communityRequirements7d: BranchRequirementReport[];

  // Recent reports log
  recentReports: BranchRecentReport[];
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
    operatingHours: '08:00–17:00',
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
      { tag: 'Updated MedCert', count: 12 },
      { tag: 'Short bond only', count: 5 },
    ],
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
    operatingHours: '08:00–17:00',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDIVd2lrAYL1Qg54Pz7-Gt_TOD2GBPDKEIlDtl15TZEzlsW7sVg8EffwaNrQ-Uv7cS_mGrtChEILO-Siksfzkfm0FrUvUbi7j8CYMPV7-hYQxPi4ue_FPNgvNvMEj9kxIy0grVPAyj5ccUq0XegMJ0RH6G-kNM_D_OhMLMsDWrqulPE02c6MFePG_iymv38Ra69HV2wIJro8o6RTcyNYJh_XXSLGOUcGhyNlXI-EBkNmFsodhnj0N47lMbKQX6p3J520QdeyLJow7iG',
    hasPlasticCards: false,
    grade: 'A',
    reportsToday: 18,
    is_puno: false,
    hasActiveAnomaly: false,
    walkinAvgMinutes: 100,
    appointmentAvgMinutes: 20,
    prequeueMinutesBeforeOpen: 15,
    communityRequirements7d: [],
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
    operatingHours: '08:00–17:00',
    thumbnailUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDIVd2lrAYL1Qg54Pz7-Gt_TOD2GBPDKEIlDtl15TZEzlsW7sVg8EffwaNrQ-Uv7cS_mGrtChEILO-Siksfzkfm0FrUvUbi7j8CYMPV7-hYQxPi4ue_FPNgvNvMEj9kxIy0grVPAyj5ccUq0XegMJ0RH6G-kNM_D_OhMLMsDWrqulPE02c6MFePG_iymv38Ra69HV2wIJro8o6RTcyNYJh_XXSLGOUcGhyNlXI-EBkNmFsodhnj0N47lMbKQX6p3J520QdeyLJow7iG',
    hasPlasticCards: true,
    grade: 'B',
    reportsToday: 27,
    is_puno: false,
    hasActiveAnomaly: true,
    anomalyDescription: 'May biglaang system downtime na na-report sa cashier.',
    walkinAvgMinutes: 140,
    appointmentAvgMinutes: 50,
    prequeueMinutesBeforeOpen: 30,
    communityRequirements7d: [{ tag: 'Extra photocopy', count: 3 }],
    recentReports: [
      { id: 'r9', queuePrefix: 'Q', transactionType: 'License Renewal', waitMinutes: 150, isAnomaly: false, createdAt: Date.now() - 40 * 60 * 1000 },
      { id: 'r10', queuePrefix: 'Q', transactionType: 'New License', waitMinutes: 165, isAnomaly: true, createdAt: Date.now() - 90 * 60 * 1000 },
    ],
  },
];

export const getBranchesMock = async (): Promise<Branch[]> => {
  // IMPROVEMENT 3: Mimic async fetch so screens can show skeleton loading states.
  await new Promise((r) => setTimeout(r, 650));
  return BRANCHES;
};

