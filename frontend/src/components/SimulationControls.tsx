/**
 * SimulationControls.tsx
 * Analysis configuration: attacker search strategy, endpoints, and the
 * defender's honeypot budget.
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

const STRATEGY_NOTES: Record<SearchAlgorithm, string> = {
  BFS: 'Fewest hops; ignores edge cost.',
  DFS: 'Deepest branch first; no optimality guarantee.',
  UCS: 'Lowest cumulative cost; optimal.',
  'A*': 'Cost plus admissible hop heuristic; optimal.',
}

export function SimulationControls({
  nodeNames,
  settings,
  onChange,
  onRun,
  isRunning,
}: SimulationControlsProps) {
  const update = (patch: Partial<SimulationSettings>) => onChange({ ...settings, ...patch })

  const missing = !settings.startNode || !settings.targetNode
  const sameEndpoints = !missing && settings.startNode === settings.targetNode
  const invalidReason = missing
    ? 'Choose a start and a target node.'
    : sameEndpoints
      ? 'Start and target must be different nodes.'
      : null

  return (
    <section className="panel p-4">
      <h2 className="panel-title">Analysis configuration</h2>
      <p className="panel-subtitle">Simulation controls for the attacker and defender agents.</p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="field-label">Search strategy</span>
          <select
            aria-label="Algorithm"
            className="field"
            value={settings.algorithm}
            onChange={(event) => update({ algorithm: event.target.value as SearchAlgorithm })}
          >
            {SEARCH_ALGORITHMS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-2xs text-fg-faint">{STRATEGY_NOTES[settings.algorithm]}</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Start node</span>
            <select
              aria-label="Start node"
              className="field"
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

          <label className="block">
            <span className="field-label">Target node</span>
            <select
              aria-label="Target node"
              className="field"
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
        </div>

        <label className="block">
          <span className="field-label">Honeypot budget</span>
          <select
            aria-label="Honeypots"
            className="field"
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
        disabled={isRunning || invalidReason !== null}
        className="btn-primary mt-4 w-full"
      >
        {isRunning ? 'Running…' : 'Run Simulation'}
      </button>
      {invalidReason && <p className="mt-2 text-xs text-warn">{invalidReason}</p>}
    </section>
  )
}
