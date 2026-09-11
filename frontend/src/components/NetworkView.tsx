/**
 * NetworkView.tsx
 * Structured list of the simulated network's nodes and edges.
 * Deliberately a table for now — graph visualization comes in a later step.
 */

import type { NetworkResponse } from '../api/types'

const CRITICALITY_STYLES: Record<string, string> = {
  high: 'bg-red-950 text-red-300 border-red-800',
  medium: 'bg-amber-950 text-amber-300 border-amber-800',
  low: 'bg-slate-800 text-slate-300 border-slate-700',
}

export function NetworkView({ network }: { network: NetworkResponse }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Network topology</h2>
      <p className="mt-1 text-sm text-slate-400">
        Attacker start <span className="text-slate-200">{network.attacker_start}</span> · critical
        asset <span className="text-slate-200">{network.critical_target}</span>
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-slate-400">Nodes ({network.nodes.length})</h3>
          <ul className="mt-2 space-y-1">
            {network.nodes.map((node) => (
              <li
                key={node.id}
                className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              >
                <span className="text-slate-200">{node.name}</span>
                <span
                  className={`rounded border px-2 py-0.5 text-xs ${
                    CRITICALITY_STYLES[node.criticality] ?? CRITICALITY_STYLES.low
                  }`}
                >
                  {node.type}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-400">Edges ({network.edges.length})</h3>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-1 font-medium">Source</th>
                <th className="py-1 font-medium">Target</th>
                <th className="py-1 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {network.edges.map((edge) => (
                <tr key={`${edge.source}-${edge.target}`} className="border-t border-slate-800">
                  <td className="py-1">{edge.source}</td>
                  <td className="py-1">{edge.target}</td>
                  <td className="py-1 text-right tabular-nums">{edge.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
