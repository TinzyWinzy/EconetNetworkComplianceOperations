// DemoGate — lightweight presenter lock for the pilot.
// NOTE: This is a demo/casual-gate, NOT production security. The PIN is
// verified client-side so anyone with source access can bypass it. Its job is
// to keep the public pilot URL from being casually opened by outsiders.
// Requires a PIN. Set via VITE_DEMO_PIN (defaults in .env). Unlock persists in
// sessionStorage so a refresh doesn't re-prompt; closing the tab re-locks.
import { useState } from 'react';
import type { ReactNode } from 'react';

const DEFAULT_PIN = '1212';
const PIN = (import.meta.env.VITE_DEMO_PIN as string | undefined) || DEFAULT_PIN;
const STORAGE_KEY = 'econet-demo-unlocked';

export default function DemoGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STORAGE_KEY) === '1');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setUnlocked(true);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0e2a47] p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        aria-label="Demo access"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#c9a227] font-bold text-[#0e2a47]">E</div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#c9a227]">Econet Wireless · Harare pilot</p>
            <h1 className="text-base font-bold leading-tight text-slate-900">Network compliance operations</h1>
          </div>
        </div>

        <label htmlFor="pin" className="mt-5 block text-sm font-semibold text-slate-700">
          Enter demo PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder="••••"
          className="tnum mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl tracking-[0.5em] focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/30"
          aria-invalid={error}
        />

        {error && (
          <p className="mt-2 text-sm font-medium text-red-600" role="alert">
            Incorrect PIN. Please try again.
          </p>
        )}

        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-[#0e2a47] py-2.5 font-semibold text-white transition hover:bg-[#13385e]"
        >
          Unlock console
        </button>

        <p className="mt-4 text-[11px] leading-snug text-slate-500">
          Pilot access gate — verifies a shared demo PIN only. Not production authentication; real RBAC replaces this in the pilot phase.
        </p>
      </form>
    </div>
  );
}
