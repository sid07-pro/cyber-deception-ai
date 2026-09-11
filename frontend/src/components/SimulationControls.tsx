/**
 * SimulationControls.tsx
 * Selectors for the attacker strategy, endpoints, and deception settings.
 */

import { SEARCH_ALGORITHMS, type SearchAlgorithm } from '../api/types'

export interface SimulationSettings {
  algorithm: SearchAlgorithm
  startNode: string
  targetNode: string
  honeypotCount: number
}

interface SimulationControlsProps {
  nodeNames: string[]
  settings: SimulationSettings
  onChange: (settings: SimulationSettings) => void
  onRun: () => void
  isRunning: boolean
}

const SELECT_CLASS =
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100'

export function SimulationControls({
  nodeNames,
  settings,
  onChange,
  onRun,
  isRunning,
}: SimulationControlsProps) {
  const update = (patch: Partial<SimulationSettings>) => onChange({ ...settings, ...patch })

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Simulation controls</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-slate-400">Algorithm</span>
          <select
            aria-label="Algorithm"
            className={SELECT_CLASS}
            value={settings.algorithm}
            onChange={(event) => update({ algorithm: event.target.value as SearchAlgorithm })}
          >
            {SEARCH_ALGORITHMS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-slate-400">Start node</span>
          <select
            aria-label="Start node"
            className={SELECT_CLASS}
            value={settings.startNode}
            onChange={(event) => update({ startNode: event.target.value })}
          >
            {nodeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-slate-400">Target node</span>
          <select
            aria-label="Target node"
            className={SELECT_CLASS}
            value={settings.targetNode}
            onChange={(event) => update({ targetNode: event.target.value })}
          >
            {nodeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-slate-400">Honeypots</span>
          <select
            aria-label="Honeypots"
            className={SELECT_CLASS}
            value={settings.honeypotCount}
            onChange={(event) => update({ honeypotCount: Number(event.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {isRunning ? 'Running…' : 'Run Simulation'}
      </button>
    </section>
  )
}
