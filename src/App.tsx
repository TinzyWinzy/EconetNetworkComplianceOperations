import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Compass } from 'lucide-react';
import NOCDashboard from './components/NOCDashboard';
import Incidents from './components/Incidents';
import FleetGrid from './components/FleetGrid';
import FleetTable from './components/FleetTable';
import ActionQueue from './components/ActionQueue';
import ExecBriefing from './components/ExecBriefing';
import SubscriberCare from './components/SubscriberCare';
import PhoneSimulator from './components/PhoneSimulator';
import ComplianceValue from './components/ComplianceValue';
import ComplianceDossier from './components/ComplianceDossier';
import DemoGuide from './components/DemoGuide';
import AuditLogTable from './components/AuditLogTable';
import Integration from './components/Integration';
import type { GuideStep } from './components/DemoGuide';
import ErrorBoundary from './components/ErrorBoundary';
import { useTowerTelemetry } from './hooks/useTowerTelemetry';
import { useOpsPersistence } from './hooks/useOpsPersistence';
import { calculateDynamicROI } from './lib/roi';
import { exposureOf } from './lib/exposure';
import type { AuditEntry } from './types';

const GeoMap = lazy(() => import('./components/GeoMap'));

type Tab = 'overview' | 'briefing' | 'fleet' | 'subscribers' | 'reports' | 'integration';
type Feed = 'live' | 'grid-event';
type Role = 'noc' | 'executive';
type FleetView = 'grid' | 'table' | 'map';
type SubscriberView = 'customer' | 'care';

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function App() {
  const [role, setRole] = useState<Role>(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get('to') === 'fungai' || q.get('role') === 'executive' ? 'executive' : 'noc';
  });
  const [tab, setTab] = useState<Tab>(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get('to') === 'fungai' || q.get('role') === 'executive' ? 'briefing' : 'overview';
  });
  const [feed, setFeed] = useState<Feed>('live');
  const [module1, setModule1] = useState(true);
  const [module2, setModule2] = useState(true);
  const [fleetView, setFleetView] = useState<FleetView>('grid');
  const [subscriberView, setSubscriberView] = useState<SubscriberView>('customer');
  const [guideOpen, setGuideOpen] = useState(false);
  const { assignments, audit, resolutions, synced, syncError, log, assign, resolve, deflect } = useOpsPersistence();
  const clock = useClock();

  // Assign with QoS shield guard + audit trail (mirrors previous local behaviour).
  const handleAssign = (towerId: string, crew = 'Crew A — North') => {
    if (!module1) return;
    assign(towerId, crew);
    const t = live.find((x) => x.id === towerId);
    log('NOC Operator', 'Crew assigned', `${towerId} ${t ? t.name : ''} → ${crew}`);
  };

  const shedding = feed === 'grid-event';
  const { towers: live, loading, error, lastUpdated, refresh } = useTowerTelemetry(shedding);

  // Crew assignment marks dispatch only — live status stays until NOC confirms
  // restoration via real telemetry. Assigned sites show blue outline in fleet view.
  const towers = useMemo(() => live, [live]);

  const roi = useMemo(() => calculateDynamicROI(towers, 0, module1, module2), [towers, module1, module2]);
  const openCases = useMemo(() => towers.filter((t) => exposureOf(t) > 0 && !assignments.has(t.id)).length, [towers, assignments]);

  const tabs: { id: Tab; label: string }[] =
    role === 'executive'
      ? [
          { id: 'briefing', label: 'Briefing' },
          { id: 'fleet', label: 'Tower fleet' },
          { id: 'subscribers', label: 'Subscribers' },
          { id: 'reports', label: 'Evidence' },
          { id: 'integration', label: 'Integration' }
        ]
      : [
          { id: 'overview', label: 'Overview' },
          { id: 'fleet', label: 'Tower fleet' },
          { id: 'subscribers', label: 'Subscribers' },
          { id: 'reports', label: 'Reports' },
          { id: 'integration', label: 'Integration' }
        ];
  const readOnly = role === 'executive';

  const switchRole = (r: Role) => {
    setRole(r);
    setTab(r === 'executive' ? 'briefing' : 'overview');
  };

  const openGuideStep = (step: GuideStep) => {
    setRole('noc');
    setTab(step.action.tab);
    if (step.action.fleetView) setFleetView(step.action.fleetView);
    if (step.action.subscriberView) setSubscriberView(step.action.subscriberView);
  };

  return (
    <ErrorBoundary>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 bg-gradient-to-r from-[#2D3187] via-[#2d358b] to-[#1e40af] text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9222f] font-bold text-white" aria-hidden="true">E</div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#ffb3b8]">Econet Wireless · Harare pilot</p>
                <h1 className="text-base font-bold leading-tight">Network compliance operations</h1>
              </div>
            </div>
            <span className="sr-only" role="status">{openCases > 0 ? `${openCases} open compliance ${openCases === 1 ? 'case' : 'cases'}` : 'No open compliance cases'}</span>
            <div className="tnum flex items-center gap-3 text-xs text-blue-200">
              <span className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {error ? 'Cached feed' : 'Live'}
              </span>
              <span title="Ops state persistence" className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${syncError ? 'bg-amber-400' : synced ? 'bg-emerald-400' : 'bg-sky-400 animate-pulse'}`} />
                {syncError ? 'Ops offline' : synced ? 'Ops stored' : 'Ops syncing…'}
              </span>
              <span>{clock}</span>
              <button
                onClick={() => setGuideOpen(true)}
                aria-haspopup="dialog"
                className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
              >
                <Compass size={14} /> Demo guide
              </button>
              <span className="flex items-center gap-1 rounded bg-white/10 p-1" role="group" aria-label="Acting role">
                <button onClick={() => switchRole('noc')} className={`rounded px-2 py-0.5 font-semibold ${role === 'noc' ? 'bg-white text-[#2d358b]' : 'text-blue-200'}`}>
                  NOC
                </button>
                <button onClick={() => switchRole('executive')} className={`rounded px-2 py-0.5 font-semibold ${role === 'executive' ? 'bg-[#c80f22] text-white' : 'text-blue-200'}`}>
                  Executive
                </button>
              </span>
            </div>
          </div>
          <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 pb-2" aria-label="Primary">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-white text-[#2d358b]' : 'text-blue-200 hover:bg-white/10'}`}
              >
                {t.label}
                {t.id === 'overview' && openCases > 0 && (
                  <span className="tnum ml-1 rounded bg-red-600 px-1.5 text-xs text-white">{openCases}</span>
                )}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 rounded-lg bg-white/10 p-1 text-xs" role="group" aria-label="Network feed">
              <button onClick={() => setFeed('live')} className={`rounded px-2 py-1 font-semibold ${feed === 'live' ? 'bg-white text-[#2d358b]' : 'text-blue-200'}`}>
                Live feed
              </button>
              <button onClick={() => setFeed('grid-event')} className={`rounded px-2 py-1 font-semibold ${feed === 'grid-event' ? 'bg-amber-400 text-[#2d358b]' : 'text-blue-200'}`}>
                Grid event replay
              </button>
            </div>
          </nav>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl space-y-4 p-4">
          {feed === 'grid-event' && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
              <span className="font-bold">REPLAY</span> — ZESA 14:00 load-shedding schedule. Crew assignments made here are logged as drill actions.
              {error && ' Telemetry service unreachable; showing last cached snapshot.'}
            </p>
          )}

          {tab === 'overview' && (
            <>
              <NOCDashboard towers={towers} openCases={openCases} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Incidents towers={towers} />
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
                  <p className="font-bold text-slate-900">Control layer status</p>
                  <p className="mt-1 text-slate-600">Read-only sidecar on OCS + NOC feeds. No write path to switches or charging — a failure here cannot drop a call or corrupt billing.</p>
                  <p className="tnum mt-2 text-xs text-slate-500">
                    Last sync {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
                    {loading ? ' · syncing…' : ''} · HMAC-SHA256 PII gateway · TLS 1.3 / AES-256
                    {!loading && !error && (
                      <button onClick={refresh} className="ml-2 underline">Refresh now</button>
                    )}
                  </p>
                  <div className="mt-2 flex gap-4 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={module1} onChange={(e) => setModule1(e.target.checked)} /> QoS shield active</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={module2} onChange={(e) => setModule2(e.target.checked)} /> Care deflection active</label>
                  </div>
                </div>
              </div>
              <ActionQueue towers={towers} assignments={assignments} onAssign={handleAssign} readOnly={readOnly} />
            </>
          )}

          {tab === 'briefing' && (
            <ExecBriefing towers={towers} roi={roi} resolutions={resolutions} audit={audit} lastUpdated={lastUpdated} />
          )}

          {tab === 'fleet' && (
            <>
              <div className="flex items-center gap-1 rounded-lg bg-white/80 p-1 text-xs shadow-sm" role="group" aria-label="Fleet view">
                <button onClick={() => setFleetView('grid')} className={`rounded px-2.5 py-1 font-semibold ${fleetView === 'grid' ? 'bg-[#2d358b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  Grid
                </button>
                <button onClick={() => setFleetView('table')} className={`rounded px-2.5 py-1 font-semibold ${fleetView === 'table' ? 'bg-[#2d358b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  Table
                </button>
                <button onClick={() => setFleetView('map')} className={`rounded px-2.5 py-1 font-semibold ${fleetView === 'map' ? 'bg-[#2d358b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  Map
                </button>
              </div>
              {fleetView === 'map' ? (
                <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading map…</div>}>
                  <GeoMap towers={towers} />
                </Suspense>
              ) : fleetView === 'table' ? (
                <FleetTable towers={towers} assignments={assignments} onAssign={(id) => handleAssign(id)} readOnly={readOnly} />
              ) : (
                <FleetGrid towers={towers} loading={loading} assignments={assignments} onAssign={(id) => handleAssign(id)} readOnly={readOnly} />
              )}
            </>
          )}

          {tab === 'subscribers' && (
            <>
              <div className="flex items-center gap-1 rounded-lg bg-white/80 p-1 text-xs shadow-sm" role="group" aria-label="Subscriber view">
                <button onClick={() => setSubscriberView('customer')} className={`rounded px-2.5 py-1 font-semibold ${subscriberView === 'customer' ? 'bg-[#2d358b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  Customer journey
                </button>
                <button onClick={() => setSubscriberView('care')} className={`rounded px-2.5 py-1 font-semibold ${subscriberView === 'care' ? 'bg-[#2d358b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  Care desk
                </button>
              </div>
              {subscriberView === 'customer' ? (
                <PhoneSimulator onDeflect={deflect} />
              ) : (
                <SubscriberCare onResolve={resolve} readOnly={readOnly} />
              )}
            </>
          )}

          {tab === 'reports' && (
            <>
              <ComplianceDossier towers={towers} audit={audit} resolutions={resolutions} module1={module1} module2={module2} />
              <ComplianceValue roi={roi} towers={towers} resolutions={resolutions} module1={module1} module2={module2} />
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Shift audit log">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold text-slate-900">Shift audit log · <span className="tnum">{audit.length}</span></h2>
                  {audit.length > 0 && (
                    <button
                      onClick={() => {
                        const csv = ['time,actor,action,detail', ...audit.map((a) => `${a.time},${a.actor},${a.action},"${a.detail.replace(/"/g, '""')}"`)].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const el = document.createElement('a');
                        el.href = URL.createObjectURL(blob);
                        el.download = `shift-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
                        el.click();
                        URL.revokeObjectURL(el.href);
                      }}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                    >
                      Export audit CSV
                    </button>
                  )}
                </div>
                {audit.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No actions logged this shift. Crew assignments and care resolutions appear here for POTRAZ filing.</p>
                ) : (
                  <AuditLogTable audit={audit} />
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  Basis: SI 154 fines US$5,000 base + US$5,000/hr over 3 hrs, US$200/tower-month; model baseline 10,000 calls/mo, 15% billing-related, 30% deflection, 75% shielding — validate against Econet NOC and call-centre records before filing.
                </p>
              </section>
            </>
          )}

          {tab === 'integration' && <Integration />}
        </main>

        <footer className="tnum mx-auto max-w-6xl px-4 pb-8 text-[11px] text-slate-500">
          RadBit compliance sidecar · pilot v1.0 · {lastUpdated ? `synced ${new Date(lastUpdated).toLocaleString()}` : 'awaiting first sync'}
        </footer>
      </div>
      <DemoGuide open={guideOpen} onClose={() => setGuideOpen(false)} onNavigate={openGuideStep} />
    </ErrorBoundary>
  );
}
