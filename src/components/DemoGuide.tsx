import { useEffect, useRef } from 'react';
import { Compass, X } from 'lucide-react';

export interface GuideStep {
  id: string;
  num: number;
  title: string;
  body: string;
  cta: string;
  action: { tab: 'overview' | 'fleet' | 'subscribers' | 'reports'; fleetView?: 'map'; subscriberView?: 'customer' };
}

const STEPS: GuideStep[] = [
  {
    id: 'overview',
    num: 1,
    title: 'QoS Command Centre',
    body: 'The live SI 154 shield: watch cell availability, DSASR and DSDR across 100 Harare sites. Flip to "Grid event replay" to see ZESA load-shedding push towers toward a US$110,000 outage — then assign a crew to stop the clock.',
    cta: 'Open the command centre',
    action: { tab: 'overview' }
  },
  {
    id: 'map',
    num: 2,
    title: 'Geographic risk map',
    body: 'Every tower plotted by location and colour-coded green, amber or red by compliance risk. This is how NOC engineers route diesel and crews before a tower crosses the 3-hour POTRAZ line.',
    cta: 'Open the map',
    action: { tab: 'fleet', fleetView: 'map' }
  },
  {
    id: 'customer',
    num: 3,
    title: 'Customer FUP journey',
    body: 'Drag the subscriber slider past 50 / 80 / 90 / 100% to watch SMS alerts fire and delivery latency stay under the 1.5s SLA. Each self-served alert is a call-centre ticket Econet never pays for.',
    cta: 'Open the customer journey',
    action: { tab: 'subscribers', subscriberView: 'customer' }
  },
  {
    id: 'reports',
    num: 4,
    title: 'POTRAZ dossier export',
    body: 'One click turns the live state into a formal, timestamped PDF dossier and CSV schedule — the evidence pack filed with POTRAZ, and the 80 hours/month of reporting labour this saves.',
    cta: 'Open reports',
    action: { tab: 'reports' }
  }
];

/**
 * Accessible guided demo: a modal dialog that walks Fungai through the four
 * views in order. Keyboard navigable (arrow keys not required; Tab + Escape
 * work, focus is trapped and returned on close).
 */
export default function DemoGuide({
  open,
  onClose,
  onNavigate
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (step: GuideStep) => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-guide-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-r from-[#2D3187] via-[#2d358b] to-[#1e40af] px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <h2 id="demo-guide-title" className="flex items-center gap-2 font-bold">
              <Compass size={18} /> Demo guide — 4 views, one story
            </h2>
            <button ref={closeRef} onClick={onClose} aria-label="Close guide" className="rounded p-1 hover:bg-white/15">
              <X size={18} />
            </button>
          </div>
          <p className="mt-1 text-xs text-blue-100">A 2-minute walkthrough of how the sidecar shields fines and deflects support calls.</p>
        </div>

        <ol className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {STEPS.map((s) => (
            <li key={s.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start gap-3">
                <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2d358b] text-sm font-bold text-white">
                  {s.num}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.body}</p>
                  <button
                    onClick={() => {
                      onNavigate(s);
                      onClose();
                    }}
                    className="mt-2 rounded-lg bg-[#c80f22] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#a30c1b]"
                  >
                    {s.cta}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-t border-slate-200 px-5 py-3 text-right">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
