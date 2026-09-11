/**
 * StepControls.tsx
 * Start / Step / Reset for the stepped attacker-vs-defender simulation,
 * plus the live status of the current session.
 */

import type { SimulationStateResponse } from '../api/types'

const OUTCOME_LABELS: Record<string, string> = {
  intercepted: 'Attacker intercepted by a honeypot',
  target_reached: 'Attacker reached the protected asset',
  failed: 'No route to the target exists',
  invalid: 'Invalid scenario — nothing to simulate',
}

const OUTCOME_STYLES: Record<string, string> = {
  intercepted: 'text-emerald-400',
  target_reached: 'text-red-400',
  failed: 'text-slate-300',
  invalid: 'text-slate-300',
}

interface StepControlsProps {
  session: SimulationStateResponse | null
  isBusy: boolean
  onStart: () => void
  onStep: () => void
  onReset: () => void
}

export function StepControls({
  session,
  isBusy,
  onStart,
  onStep,
  onReset,
}: StepControlsProps) {
  const canStep = session !== null && !session.is_complete && !isBusy
  const canReset = session !== null && !isBusy

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold text-slate-100">Stepped simulation</h2>

        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          Start Simulation
        </button>
        <button
          type="button"
          onClick={onStep}
          disabled={!canStep}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          Step
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          Reset
        </button>
      </div>

      {session === null ? (
        <p className="mt-3 text-sm text-slate-400">
          No session yet. Select Start Simulation to plan the attack and deploy honeypots.
        </p>
      ) : (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Attacker position</dt>
            <dd className="text-slate-200">{session.attacker_position}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Time step</dt>
            <dd className="tabular-nums text-slate-200">{session.time_step}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className={session.outcome ? OUTCOME_STYLES[session.outcome] : 'text-slate-200'}>
              {session.outcome ? OUTCOME_LABELS[session.outcome] : session.status}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Visited nodes</dt>
            <dd className="text-slate-200">{session.visited_nodes.join(' → ')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Risk level</dt>
            <dd className="text-slate-200">{session.protection.risk_level}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}
