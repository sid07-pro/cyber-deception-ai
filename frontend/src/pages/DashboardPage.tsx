/**
 * DashboardPage.tsx
 * Overview: backend status, scenario at a glance, and what each section does.
 */

import type { NetworkResponse } from '../api/types'
import { HealthStatus } from '../components/HealthStatus'
import { NetworkGraph } from '../components/NetworkGraph'

const SECTIONS = [
  ['Simulation', 'Predict the attacker route, place honeypots, and step the attack forward.'],
  ['Advanced AI', 'Minimax, Alpha-Beta, Bayesian risk, Hill Climbing, and the Genetic Algorithm.'],
  ['Planning', 'Forward and backward state-space plans for defending the asset.'],
  ['Experiment Lab', 'Repeat runs, compare strategies, and export the metrics.'],
  ['Saved Scenarios', 'Persist topologies and experiment history in the database.'],
  ['About', 'Methodology, metrics, and limitations.'],
] as const

export function DashboardPage({ network }: { network: NetworkResponse }) {
  const criticalNodes = network.nodes.filter((node) => node.criticality === 'high')

  return (
    <div className="space-y-6">
      <HealthStatus />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hosts" value={network.nodes.length} />
        <Stat label="Links" value={network.edges.length} />
        <Stat label="Honeypot candidates" value={network.honeypot_candidates.length} />
        <Stat label="Critical assets" value={criticalNodes.length} />
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-100">Current scenario</h2>
          <p className="text-sm text-slate-400">
            Attacker start <span className="text-slate-200">{network.attacker_start}</span> ·
            critical asset <span className="text-slate-200">{network.critical_target}</span>
          </p>
        </div>
        <NetworkGraph network={network} />
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">Where to go next</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {SECTIONS.map(([title, summary]) => (
            <div key={title} className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
              <dt className="text-sm font-medium text-slate-200">{title}</dt>
              <dd className="mt-1 text-sm text-slate-400">{summary}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">{value}</p>
    </div>
  )
}
