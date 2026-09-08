import type { TowerTelemetry } from '../types';

/**
 * Single source of truth for the pilot's synthetic tower fleet.
 * Shared by api/telemetry.ts, src/hooks/useTowerTelemetry.ts (offline fallback)
 * and the vite dev mock — removes the three-way generator drift that existed before.
 * Coordinates are deterministic Harare-region jitter (pilot is synthetic/demo data).
 */

const NAMES = ['Harare CBD', 'Avondale', 'Borrowdale', 'Gweru', 'Bulawayo', 'Mutare', 'Chitungwiza', 'Ruwa'];

// Harare pilot centroid + deterministic pseudo-random jitter (~±0.3° ≈ ±33 km).
const BASE_LAT = -17.825;
const BASE_LNG = 31.033;

function jitter(seed: number, prime: number, span: number): number {
  return (((seed * prime) % 1000) / 1000 - 0.5) * span;
}

export function towerCoordinates(i: number): { latitude: number; longitude: number } {
  const seed = i + 1;
  return {
    latitude: BASE_LAT + jitter(seed, 7919, 0.6),
    longitude: BASE_LNG + jitter(seed, 104729, 0.6)
  };
}

export function buildTelemetry(loadShedding: boolean, count = 100): TowerTelemetry[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `T${String(i + 1).padStart(3, '0')}`;
    const name = `${NAMES[i % NAMES.length]} Base-Station ${i + 1}`;
    const { latitude, longitude } = towerCoordinates(i);

    let status: TowerTelemetry['status'] = 'Online';
    let batteryCapacityPercent = 100;
    let cellAvailabilityPercent = 99.8;
    let dsasrPercent = 97.4;
    let dsdrPercent = 1.1;
    let droppedCallRatePercent = 0.8;
    let activeOutageDurationMinutes = 0;

    if (loadShedding && i % 7 === 0) {
      status = 'Backup Battery';
      batteryCapacityPercent = Math.max(12, 100 - i * 3);
      cellAvailabilityPercent = 78.5;
      if (batteryCapacityPercent < 15) {
        status = 'Offline';
        batteryCapacityPercent = 0;
        cellAvailabilityPercent = 54.2;
        dsasrPercent = 0.0;
        dsdrPercent = 100.0;
        droppedCallRatePercent = 100.0;
        activeOutageDurationMinutes = 185 + i * 2;
      }
    }

    return {
      id,
      name,
      region: NAMES[i % NAMES.length],
      latitude,
      longitude,
      status,
      batteryCapacityPercent,
      cellAvailabilityPercent,
      dsasrPercent,
      dsdrPercent,
      droppedCallRatePercent,
      activeOutageDurationMinutes
    };
  });
}
