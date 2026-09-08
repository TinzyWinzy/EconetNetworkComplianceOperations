/**
 * Canonical shared contracts per api-integration-spec.md.
 * SI 154 limits: CA >= 67%, DSASR >= 95%, DSDR <= 2%.
 * Zero-PII: raw MSISDN never stored; only HMAC-SHA256 hex.
 */

export interface TowerTelemetry {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  status: 'Online' | 'Backup Battery' | 'Offline';
  batteryCapacityPercent: number;
  cellAvailabilityPercent: number;
  dsasrPercent: number;
  dsdrPercent: number;
  droppedCallRatePercent: number;
  activeOutageDurationMinutes: number;
}

export interface SubscriberProfile {
  hashedMsisdn: string;
  activePlan: string;
  dataUsedGb: number;
  fupLimitGb: number;
  fupRatioPercent: number;
  currentSpeedKbps: number;
  notifiedThresholds: number[];
}

export interface FinancialROIState {
  unmitigatedExposuresUsd: number;
  mitigatedSavingsUsd: number;
  supportDeflectionSavingsUsd: number;
  netYear1ValueUsd: number;
  paybackDays: number;
  roiPercent: number;
}

/** Legacy frontend Tower shape (pre-spec). Kept for migration compat. */
export interface LegacyTower {
  id: string;
  name: string;
  status: 'Online' | 'Backup Battery' | 'Offline';
  cellAvailability: number;
  dsasr: number;
  dsdr: number;
  activeOutageDuration: number;
  batteryPct?: number;
}

export function toCanonical(t: LegacyTower | TowerTelemetry): TowerTelemetry {
  if ('cellAvailabilityPercent' in t) {
    const c = t as TowerTelemetry;
    return {
      ...c,
      region: c.region ?? c.name.split(' Base-Station')[0],
      latitude: c.latitude ?? 0,
      longitude: c.longitude ?? 0
    };
  }
  const l = t as LegacyTower;
  return {
    id: l.id,
    name: l.name,
    region: l.name.split(' Base-Station')[0],
    latitude: 0,
    longitude: 0,
    status: l.status,
    batteryCapacityPercent: l.batteryPct ?? (l.status === 'Online' ? 100 : 0),
    cellAvailabilityPercent: l.cellAvailability,
    dsasrPercent: l.dsasr,
    dsdrPercent: l.dsdr,
    droppedCallRatePercent: 0.8,
    activeOutageDurationMinutes: l.activeOutageDuration
  };
}

export const SI_LIMITS = {
  cellAvailability: 67,
  dsasr: 95,
  dsdr: 2,
  outageFreeMinutes: 180,
  baseFineUsd: 5000,
  hourlyFineUsd: 5000,
  towerFineUsd: 200,
  dayCapUsd: 110000
} as const;

export interface CrewAssignment {
  towerId: string;
  crew: string;
  assignedAt: string;
  note: string;
}

export interface AuditEntry {
  time: string;
  actor: string;
  action: string;
  detail: string;
}
