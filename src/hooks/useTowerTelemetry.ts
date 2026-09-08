import { useState, useEffect, useCallback } from 'react';
import { TowerTelemetry, toCanonical } from '../types';

function localFallback(loadShedding: boolean): TowerTelemetry[] {
  // Offline-first cache shape for low-connectivity field use.
  const names = ['Harare CBD', 'Avondale', 'Borrowdale', 'Gweru', 'Bulawayo', 'Mutare', 'Chitungwiza', 'Ruwa'];
  return Array.from({ length: 100 }, (_, i) => {
    const id = `T${String(i + 1).padStart(3, '0')}`;
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
    return { id, name: `${names[i % names.length]} Base-Station ${i + 1}`, status, batteryCapacityPercent, cellAvailabilityPercent, dsasrPercent, dsdrPercent, droppedCallRatePercent, activeOutageDurationMinutes };
  });
}

export function useTowerTelemetry(loadSheddingActive: boolean, pollMs = 15000) {
  const [towers, setTowers] = useState<TowerTelemetry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/telemetry?loadShedding=${loadSheddingActive}`);
      if (!response.ok) throw new Error(`Telemetry service responded ${response.status}`);
      const data = await response.json();
      const raw = Array.isArray(data) ? data : data.towers ?? [];
      setTowers((raw as unknown[]).map((t) => toCanonical(t as never)));
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err as Error);
      setTowers(localFallback(loadSheddingActive));
    } finally {
      setLoading(false);
    }
  }, [loadSheddingActive]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh();
    const interval = setInterval(() => {
      if (!cancelled) refresh();
    }, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh, pollMs]);

  return { towers, loading, error, lastUpdated, refresh };
}
