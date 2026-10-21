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
  intercepted: 'text-ok',
  target_reached: 'text-bad',
  no_path: 'text-fg-muted',
}

export function HistoryList({ entries, selectedId, onSelect }: HistoryListProps) {
  return (
    <section className="panel p-4">
      <h2 className="panel-title">Recent simulations</h2>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">
          No simulations yet — run one to see it listed here.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {entries.map((entry) => {
            const active = entry.id === selectedId
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  aria-current={active}
                  className={`w-full rounded border px-3 py-2 text-left text-sm transition-colors duration-150 ${
                    active
                      ? 'border-gold-muted/70 bg-raised'
                      : 'border-line-soft bg-well hover:border-line-strong'
                  }`}
                >
                  <span className="block truncate text-fg">
                    {entry.result.algorithm} · {entry.result.start_node} → {entry.result.target_node}
                  </span>
                  <span className="mt-0.5 flex items-center gap-3 font-mono text-2xs">
                    <span className="tabular-nums text-fg-faint">cost {entry.result.path_cost}</span>
                    <span className={OUTCOME_BADGES[entry.result.result]}>
                      {entry.result.result.replace('_', ' ')}
                    </span>
                    <span className="ml-auto tabular-nums text-fg-faint">{entry.ranAt}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
