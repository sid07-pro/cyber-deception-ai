/**
 * App.tsx
 * Phase 0 shell: confirms the frontend can reach the FastAPI backend.
 */

import { HealthStatus } from './components/HealthStatus'

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-emerald-400">Cyber Deception AI</h1>
          <p className="mt-1 text-slate-400">
            Intelligent honeypot placement &amp; attacker path prediction — simulation only.
          </p>
        </header>
        <HealthStatus />
      </div>
    </main>
  )
}
