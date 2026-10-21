/**
 * ScenariosPage.tsx
 * Saved network scenarios and persisted experiment history.
 *
 * Persistence is optional: when the database is unreachable the API answers
 * 503 and this page shows that as an error rather than breaking the app.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  deleteScenario,
  listScenarios,
  listStoredExperiments,
  runSimulation,
  saveCurrentNetwork,
} from '../api/client'
import {
  STRATEGY_LABELS,
  type ScenarioSummary,
  type SearchAlgorithm,
  type SimulationResponse,
  type StoredExperimentSummary,
} from '../api/types'
import { ResultPanel } from '../components/ResultPanel'

const ALGORITHMS: SearchAlgorithm[] = ['BFS', 'DFS', 'UCS', 'A*']

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; scenarioId: number }
  | { kind: 'done'; scenario: ScenarioSummary; result: SimulationResponse }
  | { kind: 'error'; scenario: ScenarioSummary; message: string }

type ListState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; items: T[] }
  | { kind: 'error'; message: string }

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString()
}

export function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ListState<ScenarioSummary>>({ kind: 'loading' })
  const [experiments, setExperiments] = useState<ListState<StoredExperimentSummary>>({
    kind: 'loading',
  })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setSaving] = useState(false)
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('A*')
  const [run, setRun] = useState<RunState>({ kind: 'idle' })

  const refresh = useCallback(() => {
    listScenarios()
      .then((items) => setScenarios({ kind: 'ready', items }))
      .catch((error: unknown) => setScenarios({ kind: 'error', message: message(error) }))

    listStoredExperiments()
      .then((items) => setExperiments({ kind: 'ready', items }))
      .catch((error: unknown) => setExperiments({ kind: 'error', message: message(error) }))
  }, [])

  useEffect(refresh, [refresh])

  const handleSave = () => {
    if (!name.trim()) {
      setSaveError('Give the scenario a name before saving.')
      return
    }

    setSaving(true)
    setSaveError(null)
    saveCurrentNetwork({ name: name.trim(), description: description.trim() })
      .then(() => {
        setName('')
        setDescription('')
        refresh()
      })
      .catch((error: unknown) => setSaveError(message(error)))
      .finally(() => setSaving(false))
  }

  const handleDelete = (scenarioId: number) => {
    if ((run.kind === 'done' || run.kind === 'error') && run.scenario.id === scenarioId) {
      setRun({ kind: 'idle' })
    }
    deleteScenario(scenarioId)
      .then(refresh)
      .catch((error: unknown) => setSaveError(message(error)))
  }

  const handleSimulate = (scenario: ScenarioSummary) => {
    setRun({ kind: 'running', scenarioId: scenario.id })
    runSimulation({ algorithm, scenario_id: scenario.id })
      .then((result) => setRun({ kind: 'done', scenario, result }))
      .catch((error: unknown) => setRun({ kind: 'error', scenario, message: message(error) }))
  }

  return (
    <div className="space-y-6">
      <section className="panel p-4">
        <h2 className="panel-title">Save the current network</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Stores the active topology, its attacker entry point, and its protected asset.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-fg-muted">Name</span>
            <input
              aria-label="Scenario name"
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. baseline-network"
            />
          </label>
          <label className="text-sm">
            <span className="text-fg-muted">Description</span>
            <input
              aria-label="Scenario description"
              className="field"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="optional"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="mt-4 btn-primary"
        >
          {isSaving ? 'Saving…' : 'Save Scenario'}
        </button>

        {saveError && (
          <div className="mt-3 rounded border border-bad/40 bg-well p-3">
            <p className="notice-error-title">Could not save</p>
            <p className="mt-1 text-sm text-fg-muted">{saveError}</p>
          </div>
        )}
      </section>

      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="panel-title">Saved scenarios</h2>
          <label className="ml-auto flex items-center gap-2 text-sm text-fg-muted">
            Simulate with
            <select
              aria-label="Scenario simulation algorithm"
              className="rounded border border-line bg-well px-2 py-1 text-fg"
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value as SearchAlgorithm)}
            >
              {ALGORITHMS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {scenarios.kind === 'loading' && (
          <p className="mt-2 text-sm text-fg-muted">Loading saved scenarios…</p>
        )}

        {scenarios.kind === 'error' && (
          <div className="mt-3 rounded border border-bad/40 bg-well p-3">
            <p className="notice-error-title">Could not load scenarios</p>
            <p className="mt-1 text-sm text-fg-muted">{scenarios.message}</p>
          </div>
        )}

        {scenarios.kind === 'ready' && scenarios.items.length === 0 && (
          <p className="mt-2 text-sm text-fg-muted">
            Nothing saved yet. Save the current network above to start a library.
          </p>
        )}

        {scenarios.kind === 'ready' && scenarios.items.length > 0 && (
          <ul className="mt-3 space-y-2">
            {scenarios.items.map((scenario) => (
              <li
                key={scenario.id}
                className="rounded border border-line-soft bg-well px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{scenario.name}</span>
                  <span className="text-xs text-fg-faint">
                    {scenario.node_count} nodes · {scenario.edge_count} edges ·{' '}
                    {scenario.experiment_count} experiment(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSimulate(scenario)}
                    disabled={run.kind === 'running'}
                    aria-label={`Simulate ${scenario.name}`}
                    className="ml-auto rounded border border-ok/40 px-2 py-1 text-xs text-gold-champagne hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {run.kind === 'running' && run.scenarioId === scenario.id
                      ? 'Simulating…'
                      : 'Simulate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(scenario.id)}
                    aria-label={`Delete ${scenario.name}`}
                    className="rounded border border-line px-2 py-1 text-xs text-fg-soft hover:border-bad/60 hover:text-bad"
                  >
                    Delete
                  </button>
                </div>
                {scenario.description && (
                  <p className="mt-1 text-fg-muted">{scenario.description}</p>
                )}
                <p className="mt-1 text-xs text-fg-faint">
                  {scenario.attacker_start} → {scenario.critical_target} ·{' '}
                  {formatDate(scenario.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {run.kind === 'error' && (
        <div className="rounded border border-bad/40 bg-well p-3">
          <p className="notice-error-title">
            Could not simulate &ldquo;{run.scenario.name}&rdquo;
          </p>
          <p className="mt-1 text-sm text-fg-muted">{run.message}</p>
        </div>
      )}

      {run.kind === 'done' && (
        <div className="space-y-2">
          <p className="text-sm text-fg-muted">
            Simulation on saved scenario{' '}
            <span className="font-medium text-fg">{run.scenario.name}</span> (
            {run.result.start_node} → {run.result.target_node}). Simulated data only.
          </p>
          <ResultPanel result={run.result} />
        </div>
      )}

      <section className="panel p-4">
        <h2 className="panel-title">Experiment history</h2>

        {experiments.kind === 'loading' && (
          <p className="mt-2 text-sm text-fg-muted">Loading experiment history…</p>
        )}

        {experiments.kind === 'error' && (
          <div className="mt-3 rounded border border-bad/40 bg-well p-3">
            <p className="notice-error-title">Could not load history</p>
            <p className="mt-1 text-sm text-fg-muted">{experiments.message}</p>
          </div>
        )}

        {experiments.kind === 'ready' && experiments.items.length === 0 && (
          <p className="mt-2 text-sm text-fg-muted">
            No saved experiments yet. Run one in the Experiment Lab and choose Save to Database.
          </p>
        )}

        {experiments.kind === 'ready' && experiments.items.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="data-table min-w-[520px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Algorithm</th>
                  <th>Strategy</th>
                  <th className="text-right">Runs</th>
                  <th className="text-right">Intercepted</th>
                </tr>
              </thead>
              <tbody>
                {experiments.items.map((row) => (
                  <tr key={row.experiment_id} className="text-fg-soft">
                    <td>{formatDate(row.created_at)}</td>
                    <td>{row.algorithm}</td>
                    <td>{STRATEGY_LABELS[row.strategy] ?? row.strategy}</td>
                    <td className="text-right tabular-nums">{row.runs}</td>
                    <td className="text-right tabular-nums text-ok">
                      {Math.round(row.deception_success_rate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
