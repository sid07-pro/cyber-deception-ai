/**
 * ResultPanel.tsx
 * Renders one simulation result: decision summary, honeypot scoring,
 * alternative routes, and explanation. Every value shown is a field of the
 * /api/simulate response; nothing is derived beyond simple formatting.
 */

import type { SimulationResponse } from '../api/types'

const OUTCOME_LABELS: Record<SimulationResponse['result'], string> = {
  intercepted: 'Attacker intercepted by a honeypot',
  target_reached: 'Attacker reached the critical asset',
  no_path: 'No path to the target exists',
}

const OUTCOME_BADGES: Record<SimulationResponse['result'], { text: string; cls: string }> = {
  intercepted: { text: 'Intercepted', cls: 'border-ok/40 text-ok' },
  target_reached: { text: 'Asset reached', cls: 'border-bad/40 text-bad' },
  no_path: { text: 'No path', cls: 'border-line-strong text-fg-muted' },
}

export function ResultPanel({ result }: { result: SimulationResponse }) {
  const badge = OUTCOME_BADGES[result.result]
  const maxScore = Math.max(0, ...result.honeypot_scores.map((row) => row.deception_score)) || 1

  return (
    <section className="panel" aria-label="Simulation result">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="eyebrow">Simulation results</p>
          <h2 className="mt-0.5 text-sm font-semibold text-fg">{OUTCOME_LABELS[result.result]}</h2>
        </div>
        <span className={`badge ${badge.cls}`}>{badge.text}</span>
      </div>

      <dl className="grid gap-x-6 gap-y-3 border-b border-line px-4 py-4 sm:grid-cols-4">
        <div>
          <dt className="kv-label">Algorithm</dt>
          <dd className="kv-value font-mono">{result.algorithm}</dd>
        </div>
        <div>
          <dt className="kv-label">Route cost</dt>
          <dd className="kv-value font-mono text-lg tabular-nums text-gold">{result.path_cost}</dd>
        </div>
        {result.nodes_explored !== null && (
          <div>
            <dt className="kv-label">Nodes explored</dt>
            <dd className="kv-value font-mono tabular-nums">{result.nodes_explored}</dd>
          </div>
        )}
        {result.intercepted_at && (
          <div>
            <dt className="kv-label">Intercepted at</dt>
            <dd className="kv-value">
              {result.intercepted_at} (step {result.intercepted_at_step})
            </dd>
          </div>
        )}
        <div className="sm:col-span-4">
          <dt className="kv-label">Predicted path</dt>
          <dd className="kv-value text-gold-champagne">
            {result.path.length > 0 ? result.path.join(' → ') : 'No path found'}
          </dd>
        </div>
        <div className="sm:col-span-4">
          <dt className="kv-label">Honeypots</dt>
          <dd className="kv-value text-warn">
            {result.honeypots.length > 0 ? result.honeypots.join(', ') : 'None deployed'}
          </dd>
        </div>
      </dl>

      {result.honeypot_scores.length > 0 && (
        <div className="overflow-x-auto border-b border-line px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold text-fg-soft">Deception scoring</h3>
            <p className="font-mono text-2xs text-fg-faint">
              score = (path freq + proximity + degree) ÷ cost
            </p>
          </div>
          <table className="data-table mt-2 min-w-[520px]">
            <thead>
              <tr>
                <th>Node</th>
                <th className="text-right">Path freq</th>
                <th className="text-right">Proximity</th>
                <th className="text-right">Degree</th>
                <th className="text-right">Cost</th>
                <th className="w-40">Score</th>
              </tr>
            </thead>
            <tbody>
              {result.honeypot_scores.map((row) => (
                <tr key={row.node} className={row.selected ? 'text-fg' : 'text-fg-muted'}>
                  <td>
                    <span className="flex items-center gap-2">
                      {row.node}
                      {row.selected && <span className="badge border-warn/40 text-warn">Deployed</span>}
                    </span>
                  </td>
                  <td className="text-right font-mono tabular-nums">{row.attack_path_frequency}</td>
                  <td className="text-right font-mono tabular-nums">{row.target_proximity}</td>
                  <td className="text-right font-mono tabular-nums">{row.node_connectivity}</td>
                  <td className="text-right font-mono tabular-nums">{row.deployment_cost}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="h-1 flex-1 rounded-full bg-line-soft">
                        <span
                          className={`block h-1 rounded-full ${row.selected ? 'bg-gold' : 'bg-line-strong'}`}
                          style={{ width: `${(row.deception_score / maxScore) * 100}%` }}
                        />
                      </span>
                      <span className="w-12 text-right font-mono tabular-nums">{row.deception_score}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.alternative_paths && result.alternative_paths.length > 0 && (
        <div className="overflow-x-auto border-b border-line px-4 py-4">
          <h3 className="text-xs font-semibold text-fg-soft">Cheapest alternative routes</h3>
          <p className="mt-0.5 text-2xs text-fg-faint">
            Enumerated from the graph by total edge cost — a coverage check, not a learned
            prediction.
          </p>
          <table className="data-table mt-2 min-w-[520px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Route</th>
                <th className="text-right">Cost</th>
                <th className="text-right">Covered by</th>
              </tr>
            </thead>
            <tbody>
              {result.alternative_paths.map((route) => (
                <tr key={route.rank} className="text-fg-soft">
                  <td className="font-mono tabular-nums text-fg-faint">{route.rank}</td>
                  <td>{route.path.join(' → ')}</td>
                  <td className="text-right font-mono tabular-nums">{route.cost}</td>
                  <td className={`text-right ${route.intercepted ? 'text-warn' : 'text-bad'}`}>
                    {route.intercepted ? route.honeypots_on_path.join(', ') : 'Uncovered'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-4">
        <h3 className="text-xs font-semibold text-fg-soft">Why the AI decided this</h3>
        <ol className="mt-2 space-y-1.5 text-sm text-fg-soft">
          {result.explanation.map((line, index) => (
            <li key={line} className="flex gap-3">
              <span className="mt-0.5 font-mono text-2xs text-gold-muted">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
