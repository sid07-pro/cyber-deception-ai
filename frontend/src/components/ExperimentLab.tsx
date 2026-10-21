/**
 * ExperimentLab.tsx
 * Runs repeated simulations, compares honeypot strategies, and exports results.
 *
 * The comparison chart is plain CSS bars — no charting dependency.
 */

import { useState } from 'react'
import { runExperiment, saveExperiment } from '../api/client'
import {
  HONEYPOT_STRATEGIES,
  SEARCH_ALGORITHMS,
  STRATEGY_LABELS,
  type ExperimentResponse,
  type HoneypotStrategy,
  type SearchAlgorithm,
} from '../api/types'
import { downloadExperimentCsv, downloadExperimentJson } from '../lib/export'

type LabState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; experiment: ExperimentResponse }
  | { kind: 'error'; message: string }

const SELECT_CLASS =
  'field'

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

interface ExperimentLabProps {
  nodeNames: string[]
  defaultStart: string
  defaultTarget: string
}

export function ExperimentLab({ nodeNames, defaultStart, defaultTarget }: ExperimentLabProps) {
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('A*')
  const [strategy, setStrategy] = useState<HoneypotStrategy>('greedy')
  const [budget, setBudget] = useState(2)
  const [runs, setRuns] = useState(10)
  const [seed, setSeed] = useState(0)
  const [startNode, setStartNode] = useState(defaultStart)
  const [targetNode, setTargetNode] = useState(defaultTarget)
  const [state, setState] = useState<LabState>({ kind: 'idle' })

  const handleRun = () => {
    setState({ kind: 'running' })
    runExperiment({
      algorithm,
      strategy,
      honeypot_budget: budget,
      runs,
      seed,
      start_node: startNode,
      target_node: targetNode,
      compare_strategies: true,
    })
      .then((experiment) => setState({ kind: 'done', experiment }))
      .catch((error: unknown) =>
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
  }

  return (
    <section className="panel p-4">
      <h2 className="panel-title">Experiment lab</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-fg-muted">Algorithm</span>
          <select
            aria-label="Experiment algorithm"
            className={SELECT_CLASS}
            value={algorithm}
            onChange={(event) => setAlgorithm(event.target.value as SearchAlgorithm)}
          >
            {SEARCH_ALGORITHMS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Strategy</span>
          <select
            aria-label="Honeypot strategy"
            className={SELECT_CLASS}
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as HoneypotStrategy)}
          >
            {HONEYPOT_STRATEGIES.map((name) => (
              <option key={name} value={name}>
                {STRATEGY_LABELS[name]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Honeypot budget</span>
          <select
            aria-label="Experiment budget"
            className={SELECT_CLASS}
            value={budget}
            onChange={(event) => setBudget(Number(event.target.value))}
          >
            {[0, 1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Runs</span>
          <input
            aria-label="Runs"
            type="number"
            min={1}
            max={100}
            className={SELECT_CLASS}
            value={runs}
            onChange={(event) =>
              setRuns(Math.min(100, Math.max(1, Number(event.target.value) || 1)))
            }
          />
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Seed</span>
          <input
            aria-label="Experiment seed"
            type="number"
            min={0}
            className={SELECT_CLASS}
            value={seed}
            onChange={(event) => setSeed(Math.max(0, Number(event.target.value) || 0))}
          />
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Start node</span>
          <select
            aria-label="Experiment start node"
            className={SELECT_CLASS}
            value={startNode}
            onChange={(event) => setStartNode(event.target.value)}
          >
            {nodeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-fg-muted">Target node</span>
          <select
            aria-label="Experiment target node"
            className={SELECT_CLASS}
            value={targetNode}
            onChange={(event) => setTargetNode(event.target.value)}
          >
            {nodeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={state.kind === 'running'}
        className="mt-4 btn-primary"
      >
        {state.kind === 'running' ? 'Running…' : 'Run Experiment'}
      </button>

      {state.kind === 'idle' && (
        <p className="mt-3 text-sm text-fg-muted">
          No experiment yet. Configure the scenario and select Run Experiment.
        </p>
      )}

      {state.kind === 'running' && (
        <p className="mt-3 text-sm text-fg-muted">Running {runs} simulation(s)…</p>
      )}

      {state.kind === 'error' && (
        <div className="mt-3 rounded border border-bad/40 bg-well p-3">
          <p className="notice-error-title">Experiment failed</p>
          <p className="mt-1 text-sm text-fg-muted">{state.message}</p>
        </div>
      )}

      {state.kind === 'done' && <ExperimentReport experiment={state.experiment} />}
    </section>
  )
}

function ExperimentReport({ experiment }: { experiment: ExperimentResponse }) {
  const { metrics } = experiment
  const [saveState, setSaveState] = useState<
    { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  const handleSave = () => {
    setSaveState({ kind: 'saving' })
    saveExperiment({ experiment_id: experiment.experiment_id })
      .then(() => setSaveState({ kind: 'saved' }))
      .catch((error: unknown) =>
        setSaveState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-fg-muted">
          Experiment <span className="text-fg">{experiment.experiment_id.slice(0, 8)}</span>{' '}
          · {metrics.total_runs} run(s)
        </p>
        <button
          type="button"
          onClick={() => downloadExperimentJson(experiment)}
          className="btn-secondary"
        >
          Download JSON
        </button>
        <button
          type="button"
          onClick={() => downloadExperimentCsv(experiment)}
          className="btn-secondary"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState.kind === 'saving' || saveState.kind === 'saved'}
          className="btn-secondary"
        >
          {saveState.kind === 'saved' ? 'Saved' : 'Save to Database'}
        </button>
      </div>

      {saveState.kind === 'error' && (
        <div className="rounded border border-bad/40 bg-well p-3">
          <p className="notice-error-title">Could not save the experiment</p>
          <p className="mt-1 text-sm text-fg-muted">{saveState.message}</p>
        </div>
      )}

      <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Interception rate" value={percent(metrics.deception_success_rate)} />
        <Metric label="Attack success rate" value={percent(metrics.attack_success_rate)} />
        <Metric label="Average path cost" value={metrics.average_path_cost} />
        <Metric label="Average steps" value={metrics.average_steps} />
        <Metric label="Average nodes explored" value={metrics.average_nodes_explored} />
        <Metric label="Average honeypots" value={metrics.average_honeypot_count} />
        <Metric label="Average fitness" value={metrics.average_fitness} />
        <Metric label="Average run time (ms)" value={metrics.average_execution_ms} />
      </dl>

      {experiment.strategy_comparison.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-fg-soft">
            Strategy comparison — interception rate
          </h3>
          <ul className="mt-2 space-y-1.5">
            {experiment.strategy_comparison.map((row) => (
              <li key={row.strategy} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 text-fg-soft">
                  {STRATEGY_LABELS[row.strategy]}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <span
                    className={`block h-full rounded-full ${
                      row.strategy === experiment.configuration.strategy ? 'bg-gold' : 'bg-fg-faint/60'
                    }`}
                    style={{ width: `${Math.round(row.deception_success_rate * 100)}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-fg-muted">
                  {percent(row.deception_success_rate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <h3 className="text-xs font-semibold text-fg-soft">
          Run history {experiment.truncated_runs > 0 && `(first ${experiment.runs.length})`}
        </h3>
        <table className="data-table mt-2 min-w-[440px]">
          <thead>
            <tr>
              <th>Run</th>
              <th>Outcome</th>
              <th>Honeypots</th>
              <th className="text-right">Steps</th>
              <th className="text-right">Fitness</th>
            </tr>
          </thead>
          <tbody>
            {experiment.runs.map((run) => (
              <tr key={run.run} className="text-fg-soft">
                <td className="tabular-nums">{run.run}</td>
                <td
                  className={`py-1 ${
                    run.outcome === 'intercepted' ? 'text-ok' : 'text-bad'
                  }`}
                >
                  {run.outcome.replace('_', ' ')}
                </td>
                <td>{run.honeypots.join(', ') || '—'}</td>
                <td className="text-right tabular-nums">{run.steps}</td>
                <td className="text-right tabular-nums">{run.fitness}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-fg-soft">
        {experiment.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-line-soft bg-well px-3 py-2">
      <dt className="text-xs text-fg-faint">{label}</dt>
      <dd className="tabular-nums text-fg">{value}</dd>
    </div>
  )
}
