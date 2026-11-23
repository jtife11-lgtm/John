import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `Database access error (${parsed.operationType} on ${parsed.path || 'collection'}): ${parsed.error}`;
        }
      } catch {
        // Use plain message
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#07090F] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-8 shadow-xl space-y-5">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <h1 className="font-display text-2xl font-bold">STR SCORES encountered an issue</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {friendly}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E11D48] text-white font-semibold text-sm hover:brightness-105 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Reload STR SCORES
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
