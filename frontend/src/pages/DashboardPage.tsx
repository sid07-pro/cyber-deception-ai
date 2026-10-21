/**
 * DashboardPage.tsx
 * Overview of the modelled network and this session's analysis results.
 *
 * Every figure here comes from GET /api/network, GET /api/health, or the
 * simulations run in this browser session — nothing is invented. With no runs
 * yet, the result panels show an empty state instead of placeholder numbers.
 */

import type { PageId } from '../App'
import type { NetworkResponse } from '../api/types'
import type { ConnectionState } from '../components/HealthStatus'
import type { HistoryEntry } from '../components/HistoryList'
import { GraphLegend, NetworkGraph } from '../components/NetworkGraph'

const MODULES: [PageId, string, string][] = [
  ['path', 'Attack Path Analysis', 'BFS, DFS, UCS, A* route search with honeypot interception'],
  ['honeypot', 'Honeypot Placement', 'Greedy deception score vs. Hill Climbing and Genetic Algorithm'],
  ['advanced', 'Advanced Analysis', 'Minimax, Alpha-Beta, Bayesian risk'],
  ['planning', 'Defense Planning', 'STRIPS-style forward and backward planning'],
  ['experiments', 'Experiment Lab', 'Repeated runs comparing five placement strategies'],
  ['scenarios', 'Saved Scenarios', 'Topologies and experiment history in the database'],
]

const OUTCOME_TEXT: Record<string, { label: string; cls: string }> = {
  intercepted: { label: 'Intercepted', cls: 'text-ok' },
  target_reached: { label: 'Asset reached', cls: 'text-bad' },
  no_path: { label: 'No path', cls: 'text-fg-muted' },
}

interface DashboardPageProps {
  network: NetworkResponse
  history?: HistoryEntry[]
  health?: ConnectionState
  onNavigate?: (page: PageId) => void
}

export function DashboardPage({ network, history = [], health, onNavigate }: DashboardPageProps) {
  const criticalNodes = network.nodes.filter((node) => node.criticality === 'high')
  const latest = history[0]?.result ?? null

  return (
    <div className="space-y-5">
      <section className="panel grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x" aria-label="Network metrics">
        <Metric label="Modelled hosts" value={network.nodes.length} primary />
        <Metric label="Links" value={network.edges.length} />
        <Metric label="Critical assets" value={criticalNodes.length} />
        <Metric label="Honeypot candidates" value={network.honeypot_candidates.length} />
        <Metric label="Runs this session" value={history.length} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="panel-title">Current scenario</h2>
              <p className="panel-subtitle">
                Entry <span className="text-fg-soft">{network.attacker_start}</span> · protected asset{' '}
                <span className="text-fg-soft">{network.critical_target}</span>
              </p>
            </div>
            <span className="eyebrow">{latest ? `Overlay: latest ${latest.algorithm} run` : 'Baseline topology'}</span>
          </div>
          <div className="p-3">
            <NetworkGraph
              network={network}
              path={latest?.path ?? []}
              honeypots={latest?.honeypots ?? []}
              heightClass="h-[360px]"
            />
            <div className="mt-3 px-1">
              <GraphLegend />
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="panel p-4">
            <h2 className="panel-title">Analysis status</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <StatusRow label="API">
                {health?.kind === 'connected' ? (
                  <span className="text-ok">Connected · v{health.health.version}</span>
                ) : health?.kind === 'error' ? (
                  <span className="text-bad">Backend unreachable</span>
                ) : (
                  <span className="text-fg-faint">Checking…</span>
                )}
              </StatusRow>
              <StatusRow label="Database">
                {health?.kind === 'connected' && health.health.database ? (
                  <span className={health.health.database === 'connected' ? 'text-fg-soft' : 'text-warn'}>
                    {health.health.database}
                  </span>
                ) : (
                  <span className="text-fg-faint">—</span>
                )}
              </StatusRow>
              <StatusRow label="Last analysis">
                {history[0] ? (
                  <span className="text-fg-soft">{history[0].ranAt}</span>
                ) : (
                  <span className="text-fg-faint">None this session</span>
                )}
              </StatusRow>
            </dl>
          </section>

          <section className="panel p-4">
            <h2 className="panel-title">Latest result</h2>
            {latest ? (
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="kv-label">Outcome</dt>
                  <dd className={OUTCOME_TEXT[latest.result].cls}>{OUTCOME_TEXT[latest.result].label}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="kv-label">Strategy · cost</dt>
                  <dd className="font-mono text-fg">
                    {latest.algorithm} · <span className="text-gold">{latest.path_cost}</span>
                  </dd>
                </div>
                <div>
                  <dt className="kv-label">Route</dt>
                  <dd className="mt-0.5 text-gold-champagne">
                    {latest.path.length > 0 ? latest.path.join(' → ') : 'No path found'}
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyState onAction={onNavigate ? () => onNavigate('path') : undefined} />
            )}
          </section>

          <section className="panel p-4">
            <h2 className="panel-title">Recent defensive recommendations</h2>
            <p className="panel-subtitle">Honeypot placements chosen in this session&apos;s runs.</p>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-fg-faint">No recommendations yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line-soft text-sm">
                {history.slice(0, 4).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate text-warn">
                      {entry.result.honeypots.length > 0 ? entry.result.honeypots.join(', ') : 'No honeypots'}
                    </span>
                    <span className="shrink-0 font-mono text-2xs text-fg-faint">
                      {entry.result.algorithm} · {entry.ranAt}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="panel">
        <h2 className="panel-title border-b border-line px-4 py-3">Analysis modules</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(([id, title, summary]) => (
            <li key={id} className="border-b border-line-soft sm:border-r">
              <button
                type="button"
                onClick={onNavigate ? () => onNavigate(id) : undefined}
                className="group w-full px-4 py-3 text-left transition-colors hover:bg-raised/60"
              >
                <span className="flex items-center justify-between text-sm font-medium text-fg">
                  {title}
                  <span className="text-fg-faint transition-colors group-hover:text-gold" aria-hidden>
                    →
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-fg-muted">{summary}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Metric({ label, value, primary = false }: { label: string; value: number; primary?: boolean }) {
  return (
    <div className="px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 font-mono text-2xl tabular-nums ${primary ? 'text-gold' : 'text-fg'}`}>{value}</p>
    </div>
  )
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="kv-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function EmptyState({ onAction }: { onAction?: () => void }) {
  return (
    <div className="mt-3 rounded border border-dashed border-line px-3 py-4 text-center">
      <p className="text-sm text-fg-muted">No simulation has run yet.</p>
      <p className="mt-1 text-xs text-fg-faint">
        Run an attack path analysis to see the route, cost, and honeypot outcome here.
      </p>
      {onAction && (
        <button type="button" onClick={onAction} className="btn-primary mt-3">
          Run first analysis
        </button>
      )}
    </div>
  )
}
