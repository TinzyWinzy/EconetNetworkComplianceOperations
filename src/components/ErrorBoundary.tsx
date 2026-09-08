import { Component, ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('PoC boundary:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="m-4 rounded-xl border border-red-300 bg-red-50 p-4" role="alert">
          <p className="font-semibold text-red-800">Dashboard failed to render.</p>
          <p className="text-sm text-red-700">{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} className="mt-2 rounded bg-red-700 px-3 py-1 text-sm text-white">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
