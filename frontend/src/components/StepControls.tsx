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
  intercepted: 'text-ok',
  target_reached: 'text-bad',
  failed: 'text-fg-soft',
  invalid: 'text-fg-soft',
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
    <section className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="panel-title mr-auto">Stepped simulation</h2>

        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="btn-secondary"
        >
          Start Simulation
        </button>
        <button
          type="button"
          onClick={onStep}
          disabled={!canStep}
          className="btn-secondary"
        >
          Step
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          className="btn-secondary"
        >
          Reset
        </button>
      </div>

      {session === null ? (
        <p className="mt-3 text-sm text-fg-muted">
          No session yet. Select Start Simulation to plan the attack and deploy honeypots.
        </p>
      ) : (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-fg-faint">Attacker position</dt>
            <dd className="text-fg">{session.attacker_position}</dd>
          </div>
          <div>
            <dt className="text-fg-faint">Time step</dt>
            <dd className="tabular-nums text-fg">{session.time_step}</dd>
          </div>
          <div>
            <dt className="text-fg-faint">Status</dt>
            <dd className={session.outcome ? OUTCOME_STYLES[session.outcome] : 'text-fg'}>
              {session.outcome ? OUTCOME_LABELS[session.outcome] : session.status}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-fg-faint">Visited nodes</dt>
            <dd className="text-fg">{session.visited_nodes.join(' → ')}</dd>
          </div>
          <div>
            <dt className="text-fg-faint">Risk level</dt>
            <dd className="text-fg">{session.protection.risk_level}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}
