/**
 * ResultPanel.tsx
 * Renders one simulation result: decision summary, honeypot scoring,
 * alternative routes, and explanation.
 */

import type { SimulationResponse } from '../api/types'

const OUTCOME_LABELS: Record<SimulationResponse['result'], string> = {
  intercepted: 'Attacker intercepted by a honeypot',
  target_reached: 'Attacker reached the critical asset',
  no_path: 'No path to the target exists',
}

const OUTCOME_STYLES: Record<SimulationResponse['result'], string> = {
  intercepted: 'border-emerald-800 text-emerald-400',
  target_reached: 'border-red-800 text-red-400',
  no_path: 'border-slate-700 text-slate-300',
}

export function ResultPanel({ result }: { result: SimulationResponse }) {
  return (
    <section className={`rounded-lg border bg-slate-900 p-4 ${OUTCOME_STYLES[result.result]}`}>
      <h2 className="font-semibold">{OUTCOME_LABELS[result.result]}</h2>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Algorithm</dt>
          <dd className="text-slate-200">{result.algorithm}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Path cost</dt>
          <dd className="tabular-nums text-slate-200">{result.path_cost}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Predicted path</dt>
          <dd className="text-slate-200">
            {result.path.length > 0 ? result.path.join(' → ') : 'No path found'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Honeypots</dt>
          <dd className="text-slate-200">
            {result.honeypots.length > 0 ? result.honeypots.join(', ') : 'None deployed'}
          </dd>
        </div>
        {result.nodes_explored !== null && (
          <div>
            <dt className="text-slate-500">Nodes explored</dt>
            <dd className="tabular-nums text-slate-200">{result.nodes_explored}</dd>
          </div>
        )}
        {result.intercepted_at && (
          <div>
            <dt className="text-slate-500">Intercepted at</dt>
            <dd className="text-slate-200">
              {result.intercepted_at} (step {result.intercepted_at_step})
            </dd>
          </div>
        )}
      </dl>

      {result.honeypot_scores.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="text-sm font-medium text-slate-400">Deception scoring</h3>
          <table className="mt-2 w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-1 font-medium">Node</th>
                <th className="py-1 text-right font-medium">Path freq</th>
                <th className="py-1 text-right font-medium">Proximity</th>
                <th className="py-1 text-right font-medium">Degree</th>
                <th className="py-1 text-right font-medium">Cost</th>
                <th className="py-1 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {result.honeypot_scores.map((row) => (
                <tr
                  key={row.node}
                  className={`border-t border-slate-800 ${
                    row.selected ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  <td className="py-1">{row.node}</td>
                  <td className="py-1 text-right tabular-nums">{row.attack_path_frequency}</td>
                  <td className="py-1 text-right tabular-nums">{row.target_proximity}</td>
                  <td className="py-1 text-right tabular-nums">{row.node_connectivity}</td>
                  <td className="py-1 text-right tabular-nums">{row.deployment_cost}</td>
                  <td className="py-1 text-right tabular-nums">{row.deception_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.alternative_paths && result.alternative_paths.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="text-sm font-medium text-slate-400">Cheapest alternative routes</h3>
          <p className="mt-1 text-xs text-slate-500">
            Enumerated from the graph by total edge cost — a coverage check, not a learned
            prediction.
          </p>
          <table className="mt-2 w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-1 font-medium">#</th>
                <th className="py-1 font-medium">Route</th>
                <th className="py-1 text-right font-medium">Cost</th>
                <th className="py-1 text-right font-medium">Covered by</th>
              </tr>
            </thead>
            <tbody>
              {result.alternative_paths.map((route) => (
                <tr key={route.rank} className="border-t border-slate-800 text-slate-300">
                  <td className="py-1 tabular-nums">{route.rank}</td>
                  <td className="py-1">{route.path.join(' → ')}</td>
                  <td className="py-1 text-right tabular-nums">{route.cost}</td>
                  <td
                    className={`py-1 text-right ${
                      route.intercepted ? 'text-amber-300' : 'text-red-400'
                    }`}
                  >
                    {route.intercepted ? route.honeypots_on_path.join(', ') : 'Uncovered'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-medium text-slate-400">Why the AI decided this</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {result.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
