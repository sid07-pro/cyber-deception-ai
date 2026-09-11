/**
 * HistoryList.tsx
 * Recent simulation results for this browser session only (no persistence).
 */

import type { SimulationResponse } from '../api/types'

export interface HistoryEntry {
  id: number
  ranAt: string
  result: SimulationResponse
}

interface HistoryListProps {
  entries: HistoryEntry[]
  selectedId: number | null
  onSelect: (id: number) => void
}

const OUTCOME_BADGES: Record<SimulationResponse['result'], string> = {
  intercepted: 'text-emerald-400',
  target_reached: 'text-red-400',
  no_path: 'text-slate-400',
}

export function HistoryList({ entries, selectedId, onSelect }: HistoryListProps) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Recent simulations</h2>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          No simulations yet — run one to see it listed here.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                aria-current={entry.id === selectedId}
                className={`flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left text-sm ${
                  entry.id === selectedId
                    ? 'border-emerald-700 bg-slate-950'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
              >
                <span className="text-slate-200">
                  {entry.result.algorithm} · {entry.result.start_node} → {entry.result.target_node}
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="tabular-nums text-slate-500">cost {entry.result.path_cost}</span>
                  <span className={OUTCOME_BADGES[entry.result.result]}>
                    {entry.result.result.replace('_', ' ')}
                  </span>
                  <span className="tabular-nums text-slate-600">{entry.ranAt}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
