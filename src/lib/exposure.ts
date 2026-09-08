import { TowerTelemetry, SI_LIMITS } from '../types';
export function towerFine(t: TowerTelemetry): number {
  return t.cellAvailabilityPercent < SI_LIMITS.cellAvailability ||
    t.dsasrPercent < SI_LIMITS.dsasr ||
    t.dsdrPercent > SI_LIMITS.dsdr
    ? SI_LIMITS.towerFineUsd
    : 0;
}

export function outageFine(t: TowerTelemetry): number {
  if (t.status !== 'Offline' || t.activeOutageDurationMinutes <= SI_LIMITS.outageFreeMinutes) return 0;
  const extraHours = Math.ceil((t.activeOutageDurationMinutes - SI_LIMITS.outageFreeMinutes) / 60);
  return SI_LIMITS.baseFineUsd + extraHours * SI_LIMITS.hourlyFineUsd;
}

export function exposureOf(t: TowerTelemetry): number {
  return Math.max(towerFine(t), 0) + outageFine(t);
}

/** Fine accrued for a live outage clock given elapsed seconds. */
export function penaltyForElapsed(elapsedSec: number): number {
  const remaining = SI_LIMITS.outageFreeMinutes * 60 - elapsedSec;
  if (remaining > 0) return 0;
  const overtimeHrs = Math.floor(-remaining / 3600);
  return Math.min(SI_LIMITS.dayCapUsd, SI_LIMITS.baseFineUsd + overtimeHrs * SI_LIMITS.hourlyFineUsd);
}
