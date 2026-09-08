// useOpsPersistence — Hydrates and syncs operational state (crew assignments,
// audit log, care resolutions) with the /api/ops Neon-backed endpoint.
// Offline-tolerant: keeps optimistic local state and reconciles on reconnect.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditEntry, CrewAssignment } from '../types';

export interface OpsState {
  assignments: Map<string, CrewAssignment>;
  audit: AuditEntry[];
  resolutions: number;
  synced: boolean;
  syncError: boolean;
}

const MAX_AUDIT = 50;

async function readOps(): Promise<{ assignments: CrewAssignment[]; audit: AuditEntry[]; resolutions: number }> {
  const res = await fetch('/api/ops', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ops GET ${res.status}`);
  return res.json();
}

async function writeOps(state: Pick<OpsState, 'assignments' | 'audit' | 'resolutions'>): Promise<void> {
  const payload = {
    assignments: Array.from(state.assignments.values()),
    audit: state.audit,
    resolutions: state.resolutions
  };
  const res = await fetch('/api/ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`ops POST ${res.status}`);
}

export function useOpsPersistence() {
  const [state, setState] = useState<OpsState>({
    assignments: new Map(),
    audit: [],
    resolutions: 0,
    synced: false,
    syncError: false
  });
  const stateRef = useRef<OpsState>(state);
  stateRef.current = state;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from server on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readOps();
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          assignments: new Map(data.assignments.map((a) => [a.towerId, a])),
          audit: data.audit.slice(0, MAX_AUDIT),
          resolutions: data.resolutions,
          synced: true,
          syncError: false
        }));
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, synced: true, syncError: true }));
      }
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Debounce sync of the latest state after every mutation.
  const sync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const current = stateRef.current;
      if (!current.synced) return;
      try {
        await writeOps(current);
        setState((prev) => (prev.synced ? { ...prev, syncError: false } : prev));
      } catch {
        setState((prev) => ({ ...prev, syncError: true }));
      }
    }, 400);
  }, []);

  const log = useCallback(
    (actor: string, action: string, detail: string) => {
      setState((prev) => ({
        ...prev,
        audit: [{ time: new Date().toISOString(), actor, action, detail }, ...prev.audit].slice(0, MAX_AUDIT)
      }));
      sync();
    },
    [sync]
  );

  const assign = useCallback(
    (towerId: string, crew = 'Crew A — North', note = '') => {
      setState((prev) => {
        const next = new Map(prev.assignments);
        next.set(towerId, { towerId, crew, assignedAt: new Date().toISOString(), note: note || 'Diesel + traffic shift' });
        return { ...prev, assignments: next };
      });
      sync();
    },
    [sync]
  );

  const resolve = useCallback(
    (detail: string) => {
      setState((prev) => ({
        ...prev,
        resolutions: prev.resolutions + 1,
        audit: [{ time: new Date().toISOString(), actor: 'Care Agent', action: 'Case resolved', detail }, ...prev.audit].slice(0, MAX_AUDIT)
      }));
      sync();
    },
    [sync]
  );

  const deflect = useCallback(
    (detail: string) => {
      setState((prev) => ({
        ...prev,
        resolutions: prev.resolutions + 1,
        audit: [{ time: new Date().toISOString(), actor: 'Subscriber', action: 'FUP alert self-served', detail }, ...prev.audit].slice(0, MAX_AUDIT)
      }));
      sync();
    },
    [sync]
  );

  return { ...state, log, assign, resolve, deflect };
}
