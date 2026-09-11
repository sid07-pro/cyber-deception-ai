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
  saveCurrentNetwork,
} from '../api/client'
import {
  STRATEGY_LABELS,
  type ScenarioSummary,
  type StoredExperimentSummary,
} from '../api/types'

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
    deleteScenario(scenarioId)
      .then(refresh)
      .catch((error: unknown) => setSaveError(message(error)))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">Save the current network</h2>
        <p className="mt-1 text-sm text-slate-400">
          Stores the active topology, its attacker entry point, and its protected asset.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-slate-400">Name</span>
            <input
              aria-label="Scenario name"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. baseline-network"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-400">Description</span>
            <input
              aria-label="Scenario description"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
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
          className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {isSaving ? 'Saving…' : 'Save Scenario'}
        </button>

        {saveError && (
          <div className="mt-3 rounded border border-red-800 bg-slate-950 p-3">
            <p className="font-semibold text-red-400">Could not save</p>
            <p className="mt-1 text-sm text-slate-400">{saveError}</p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">Saved scenarios</h2>

        {scenarios.kind === 'loading' && (
          <p className="mt-2 text-sm text-slate-400">Loading saved scenarios…</p>
        )}

        {scenarios.kind === 'error' && (
          <div className="mt-3 rounded border border-red-800 bg-slate-950 p-3">
            <p className="font-semibold text-red-400">Could not load scenarios</p>
            <p className="mt-1 text-sm text-slate-400">{scenarios.message}</p>
          </div>
        )}

        {scenarios.kind === 'ready' && scenarios.items.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">
            Nothing saved yet. Save the current network above to start a library.
          </p>
        )}

        {scenarios.kind === 'ready' && scenarios.items.length > 0 && (
          <ul className="mt-3 space-y-2">
            {scenarios.items.map((scenario) => (
              <li
                key={scenario.id}
                className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-200">{scenario.name}</span>
                  <span className="text-xs text-slate-500">
                    {scenario.node_count} nodes · {scenario.edge_count} edges ·{' '}
                    {scenario.experiment_count} experiment(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(scenario.id)}
                    aria-label={`Delete ${scenario.name}`}
                    className="ml-auto rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-red-700 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
                {scenario.description && (
                  <p className="mt-1 text-slate-400">{scenario.description}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {scenario.attacker_start} → {scenario.critical_target} ·{' '}
                  {formatDate(scenario.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">Experiment history</h2>

        {experiments.kind === 'loading' && (
          <p className="mt-2 text-sm text-slate-400">Loading experiment history…</p>
        )}

        {experiments.kind === 'error' && (
          <div className="mt-3 rounded border border-red-800 bg-slate-950 p-3">
            <p className="font-semibold text-red-400">Could not load history</p>
            <p className="mt-1 text-sm text-slate-400">{experiments.message}</p>
          </div>
        )}

        {experiments.kind === 'ready' && experiments.items.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">
            No saved experiments yet. Run one in the Experiment Lab and choose Save to Database.
          </p>
        )}

        {experiments.kind === 'ready' && experiments.items.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="py-1 font-medium">When</th>
                  <th className="py-1 font-medium">Algorithm</th>
                  <th className="py-1 font-medium">Strategy</th>
                  <th className="py-1 text-right font-medium">Runs</th>
                  <th className="py-1 text-right font-medium">Intercepted</th>
                </tr>
              </thead>
              <tbody>
                {experiments.items.map((row) => (
                  <tr key={row.experiment_id} className="border-t border-slate-800 text-slate-300">
                    <td className="py-1">{formatDate(row.created_at)}</td>
                    <td className="py-1">{row.algorithm}</td>
                    <td className="py-1">{STRATEGY_LABELS[row.strategy] ?? row.strategy}</td>
                    <td className="py-1 text-right tabular-nums">{row.runs}</td>
                    <td className="py-1 text-right tabular-nums text-emerald-400">
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
