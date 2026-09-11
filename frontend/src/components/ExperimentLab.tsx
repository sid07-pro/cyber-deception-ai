/**
 * ExperimentLab.tsx
 * Runs repeated simulations, compares honeypot strategies, and exports results.
 *
 * The comparison chart is plain CSS bars — no charting dependency.
 */

import { useState } from 'react'
import { runExperiment } from '../api/client'
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
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100'

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
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Experiment lab</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-slate-400">Algorithm</span>
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
          <span className="text-slate-400">Strategy</span>
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
          <span className="text-slate-400">Honeypot budget</span>
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
          <span className="text-slate-400">Runs</span>
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
          <span className="text-slate-400">Seed</span>
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
          <span className="text-slate-400">Start node</span>
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
          <span className="text-slate-400">Target node</span>
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
        className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {state.kind === 'running' ? 'Running…' : 'Run Experiment'}
      </button>

      {state.kind === 'idle' && (
        <p className="mt-3 text-sm text-slate-400">
          No experiment yet. Configure the scenario and select Run Experiment.
        </p>
      )}

      {state.kind === 'running' && (
        <p className="mt-3 text-sm text-slate-400">Running {runs} simulation(s)…</p>
      )}

      {state.kind === 'error' && (
        <div className="mt-3 rounded border border-red-800 bg-slate-950 p-3">
          <p className="font-semibold text-red-400">Experiment failed</p>
          <p className="mt-1 text-sm text-slate-400">{state.message}</p>
        </div>
      )}

      {state.kind === 'done' && <ExperimentReport experiment={state.experiment} />}
    </section>
  )
}

function ExperimentReport({ experiment }: { experiment: ExperimentResponse }) {
  const { metrics } = experiment

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-slate-400">
          Experiment <span className="text-slate-200">{experiment.experiment_id.slice(0, 8)}</span>{' '}
          · {metrics.total_runs} run(s)
        </p>
        <button
          type="button"
          onClick={() => downloadExperimentJson(experiment)}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
        >
          Download JSON
        </button>
        <button
          type="button"
          onClick={() => downloadExperimentCsv(experiment)}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500"
        >
          Download CSV
        </button>
      </div>

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
          <h3 className="text-sm font-medium text-slate-400">
            Strategy comparison — interception rate
          </h3>
          <ul className="mt-2 space-y-1.5">
            {experiment.strategy_comparison.map((row) => (
              <li key={row.strategy} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 text-slate-300">
                  {STRATEGY_LABELS[row.strategy]}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded bg-slate-800">
                  <span
                    className="block h-full rounded bg-emerald-500"
                    style={{ width: `${Math.round(row.deception_success_rate * 100)}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-slate-400">
                  {percent(row.deception_success_rate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <h3 className="text-sm font-medium text-slate-400">
          Run history {experiment.truncated_runs > 0 && `(first ${experiment.runs.length})`}
        </h3>
        <table className="mt-2 w-full min-w-[440px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-1 font-medium">Run</th>
              <th className="py-1 font-medium">Outcome</th>
              <th className="py-1 font-medium">Honeypots</th>
              <th className="py-1 text-right font-medium">Steps</th>
              <th className="py-1 text-right font-medium">Fitness</th>
            </tr>
          </thead>
          <tbody>
            {experiment.runs.map((run) => (
              <tr key={run.run} className="border-t border-slate-800 text-slate-300">
                <td className="py-1 tabular-nums">{run.run}</td>
                <td
                  className={`py-1 ${
                    run.outcome === 'intercepted' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {run.outcome.replace('_', ' ')}
                </td>
                <td className="py-1">{run.honeypots.join(', ') || '—'}</td>
                <td className="py-1 text-right tabular-nums">{run.steps}</td>
                <td className="py-1 text-right tabular-nums">{run.fitness}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
        {experiment.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-200">{value}</dd>
    </div>
  )
}
