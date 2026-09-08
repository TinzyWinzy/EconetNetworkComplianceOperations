import { useState, useEffect } from 'react';
import { SubscriberProfile } from '../types';

const DEMO_MSISDN = '263771234567';

export function useSubscriberBilling(msisdn: string, dataUsedGb: number) {
  const [profile, setProfile] = useState<SubscriberProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const id = msisdn || DEMO_MSISDN;
    if (!id) return;
    async function syncBillingState() {
      try {
        setLoading(true);
        setError(null);
        // Prefer hashedMsisdn param (Zero-PII); api also accepts legacy msisdn/dataConsumed.
        const response = await fetch(`/api/billing?msisdn=${encodeURIComponent(id)}&dataConsumed=${dataUsedGb}`);
        if (!response.ok) throw new Error(`Billing HTTP ${response.status}`);
        const data = await response.json();
        // Normalize legacy keys (hashedToken/fupPct) to canonical spec keys.
        const canon: SubscriberProfile = {
          hashedMsisdn: data.hashedMsisdn ?? data.hashedToken ?? '',
          activePlan: data.activePlan ?? '',
          dataUsedGb: data.dataUsedGb ?? data.dataUsedGB ?? dataUsedGb,
          fupLimitGb: data.fupLimitGb ?? 100,
          fupRatioPercent: data.fupRatioPercent ?? data.fupPct ?? 0,
          currentSpeedKbps: data.currentSpeedKbps ?? (data.currentSpeed === 'Throttled to 128Kbps' ? 128 : 20000),
          notifiedThresholds: data.notifiedThresholds ?? []
        };
        setProfile(canon);
      } catch (err) {
        setError(err as Error);
        // Local fallback keeps slider demo usable offline.
        const fupLimitGb = 100;
        const pct = Math.round((Math.min(dataUsedGb, 110) / fupLimitGb) * 100);
        setProfile({
          hashedMsisdn: 'offline-demo-hash',
          activePlan: `Private ${fupLimitGb}GB FUP Limit`,
          dataUsedGb,
          fupLimitGb,
          fupRatioPercent: pct,
          currentSpeedKbps: pct >= 100 ? 128 : 20000,
          notifiedThresholds: [50, 80, 100].filter((t) => pct >= t)
        });
      } finally {
        setLoading(false);
      }
    }
    const delayDebounce = setTimeout(syncBillingState, 200);
    return () => clearTimeout(delayDebounce);
  }, [msisdn, dataUsedGb]);

  return { profile, loading, error };
}
