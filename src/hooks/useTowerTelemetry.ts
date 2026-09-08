import { useState, useEffect, useCallback } from 'react';
import { TowerTelemetry, toCanonical } from '../types';
import { buildTelemetry } from '../lib/towers';

function localFallback(loadShedding: boolean): TowerTelemetry[] {
  // Offline-first cache shape for low-connectivity field use.
  return buildTelemetry(loadShedding);
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
