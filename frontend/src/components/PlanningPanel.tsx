/**
 * PlanningPanel.tsx
 * Builds a defensive plan with forward or backward state-space search.
 */

import { useState } from 'react'
import { createPlan } from '../api/client'
import {
  GOAL_LABELS,
  GOAL_TYPES,
  PLANNING_METHODS,
  type GoalType,
  type PlanResponse,
  type PlanningMethod,
} from '../api/types'
import type { SimulationSettings } from './SimulationControls'

type PlanState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; plan: PlanResponse }
  | { kind: 'error'; message: string }

const SELECT_CLASS =
  'field'

const METHOD_LABELS: Record<PlanningMethod, string> = {
  forward: 'Forward search',
  backward: 'Backward search',
}

export function PlanningPanel({ settings }: { settings: SimulationSettings }) {
  const [method, setMethod] = useState<PlanningMethod>('forward')
  const [goalType, setGoalType] = useState<GoalType>('protect_target')
  const [maxDepth, setMaxDepth] = useState(4)
  const [state, setState] = useState<PlanState>({ kind: 'idle' })

  const handlePlan = () => {
    setState({ kind: 'loading' })
    createPlan({
      method,
      goal_type: goalType,
      start_node: settings.startNode,
      target_node: settings.targetNode,
      honeypot_budget: settings.honeypotCount,
      max_depth: maxDepth,
    })
      .then((plan) => setState({ kind: 'done', plan }))
      .catch((error: unknown) =>
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
  }

  return (
    <section className="panel p-4">
      <h2 className="panel-title">Defensive planning</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-fg-muted">Method</span>
          <select
            aria-label="Planning method"
            className={SELECT_CLASS}
            value={method}
            onChange={(event) => setMethod(event.target.value as PlanningMethod)}
          >
            {PLANNING_METHODS.map((value) => (
              <option key={value} value={value}>
                {METHOD_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Goal</span>
          <select
            aria-label="Goal"
            className={SELECT_CLASS}
            value={goalType}
            onChange={(event) => setGoalType(event.target.value as GoalType)}
          >
            {GOAL_TYPES.map((value) => (
              <option key={value} value={value}>
                {GOAL_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Max depth</span>
          <select
            aria-label="Max depth"
            className={SELECT_CLASS}
            value={maxDepth}
            onChange={(event) => setMaxDepth(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={handlePlan}
        disabled={state.kind === 'loading'}
        className="mt-4 btn-primary"
      >
        {state.kind === 'loading' ? 'Planning…' : 'Generate Plan'}
      </button>

      {state.kind === 'idle' && (
        <p className="mt-3 text-sm text-fg-muted">
          No plan yet. Choose a goal and select Generate Plan.
        </p>
      )}

      {state.kind === 'loading' && (
        <p className="mt-3 text-sm text-fg-muted">Searching for a defensive plan…</p>
      )}

      {state.kind === 'error' && (
        <div className="mt-3 rounded border border-bad/40 bg-well p-3">
          <p className="notice-error-title">Planning failed</p>
          <p className="mt-1 text-sm text-fg-muted">{state.message}</p>
        </div>
      )}

      {state.kind === 'done' && <PlanView plan={state.plan} />}
    </section>
  )
}

function PlanView({ plan }: { plan: PlanResponse }) {
  return (
    <div
      className={`mt-4 rounded border bg-well p-3 ${
        plan.success ? 'border-line' : 'border-line'
      }`}
    >
      <p className={plan.success ? 'font-semibold text-gold-champagne' : 'font-semibold text-fg-soft'}>
        {plan.success
          ? `Plan found — ${plan.plan_length} action(s), cost ${plan.plan_cost}`
          : `No plan found — ${plan.reason}`}
      </p>
      <p className="mt-1 text-sm text-fg-muted">
        Goal: {plan.goal} · {plan.explored_states} state(s) explored
      </p>

      {plan.actions.length > 0 && (
        <ol className="mt-3 space-y-1">
          {plan.actions.map((action, index) => (
            <li
              key={`${index}-${action.description}`}
              className="flex items-center gap-3 rounded border border-line-soft bg-panel px-3 py-2 text-sm"
            >
              <span className="tabular-nums text-fg-faint">{index + 1}</span>
              <span className="text-fg">{action.description}</span>
              <span className="ml-auto tabular-nums text-xs text-fg-faint">
                cost {action.cost}
              </span>
            </li>
          ))}
        </ol>
      )}

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-fg-soft">
        {plan.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
