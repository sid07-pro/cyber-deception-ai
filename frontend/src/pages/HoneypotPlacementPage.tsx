/**
 * HoneypotPlacementPage.tsx
 * Decision support for honeypot placement.
 *
 * Three existing backend methods are compared on the same scenario:
 *   - Greedy deception score  (POST /api/simulate → honeypot_scores)
 *   - Hill Climbing           (POST /api/ai/analyze, technique hill_climbing)
 *   - Genetic Algorithm       (POST /api/ai/analyze, technique genetic_algorithm)
 * Route coverage is the only client-side derivation: a set intersection of each
 * placement with the three cheapest routes the simulate response returns.
 */

import { useState } from 'react'
import { analyzeWithAI, runSimulation } from '../api/client'
import type { AIAnalyzeResponse, NetworkResponse, SimulationResponse } from '../api/types'
import { GraphLegend, NetworkGraph } from '../components/NetworkGraph'
import type { SimulationSettings } from '../components/SimulationControls'

type Settled<T> = { ok: true; value: T } | { ok: false; error: string }

interface Evaluation {
  greedy: Settled<SimulationResponse>
  hillClimbing: Settled<AIAnalyzeResponse>
  genetic: Settled<AIAnalyzeResponse>
}

type PageState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; evaluation: Evaluation }

function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : 'Unknown error' }),
  )
}

interface FitnessComponents {
  fitness?: number
  coverage?: number
  proximity?: number
  criticality?: number
  deception?: number
  cost?: number
}

function components(result: AIAnalyzeResponse): FitnessComponents {
  const value = result.metrics.components
  return value && typeof value === 'object' ? (value as FitnessComponents) : {}
}

const ASSUMPTIONS = [
  'Candidates exclude the attacker entry point and the protected asset.',
  'Path frequency counts how many of the four search algorithms’ routes pass through a node.',
  'Proximity = 1 ÷ (hops to target + 1); degree is the node’s link count.',
  'Deployment costs are fixed simulation values per host, not measured prices.',
  'Fitness (Hill Climbing, GA) = 4·coverage + 2·proximity + 1·criticality + 1.5·deception − 1·normalised cost.',
  'Greedy scores rank single nodes; fitness scores whole placements, so the two numbers are not comparable.',
]

export function HoneypotPlacementPage({
  network,
  settings,
  onSettingsChange,
}: {
  network: NetworkResponse
  settings: SimulationSettings
  onSettingsChange: (settings: SimulationSettings) => void
}) {
  const [state, setState] = useState<PageState>({ kind: 'idle' })

  const invalid = !settings.startNode || !settings.targetNode || settings.startNode === settings.targetNode

  const evaluate = () => {
    setState({ kind: 'loading' })
    const common = {
      start_node: settings.startNode,
      target_node: settings.targetNode,
      honeypot_budget: settings.honeypotCount,
      algorithm: settings.algorithm,
      seed: 0,
    }
    Promise.all([
      settle(
        runSimulation({
          algorithm: settings.algorithm,
          start_node: settings.startNode,
          target_node: settings.targetNode,
          honeypot_count: settings.honeypotCount,
        }),
      ),
      settle(analyzeWithAI({ technique: 'hill_climbing', ...common })),
      settle(analyzeWithAI({ technique: 'genetic_algorithm', ...common })),
    ]).then(([greedy, hillClimbing, genetic]) =>
      setState({ kind: 'done', evaluation: { greedy, hillClimbing, genetic } }),
    )
  }

  const greedy = state.kind === 'done' && state.evaluation.greedy.ok ? state.evaluation.greedy.value : null
  const routes = greedy?.alternative_paths ?? []
  const coverage = (placement: string[]) =>
    routes.length === 0
      ? '—'
      : `${routes.filter((route) => route.path.some((node) => placement.includes(node))).length} / ${routes.length}`

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className="panel p-4">
          <h2 className="panel-title">Placement configuration</h2>
          <p className="panel-subtitle">Uses the shared start, target, and search strategy.</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="kv-label">Entry → target</dt>
              <dd className="text-fg">
                {settings.startNode} → {settings.targetNode}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="kv-label">Attacker strategy</dt>
              <dd className="font-mono text-fg">{settings.algorithm}</dd>
            </div>
          </dl>
          <label className="mt-3 block">
            <span className="field-label">Honeypot budget</span>
            <select
              aria-label="Placement budget"
              className="field"
              value={settings.honeypotCount}
              onChange={(event) => onSettingsChange({ ...settings, honeypotCount: Number(event.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={evaluate}
            disabled={state.kind === 'loading' || invalid || settings.honeypotCount < 1}
            className="btn-primary mt-4 w-full"
          >
            {state.kind === 'loading' ? 'Evaluating…' : 'Evaluate placements'}
          </button>
          {invalid && <p className="mt-2 text-xs text-warn">Start and target must be two different nodes.</p>}
          {settings.honeypotCount < 1 && (
            <p className="mt-2 text-xs text-warn">Choose a budget of at least one honeypot.</p>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="panel-title">Assumptions</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-fg-muted">
            {ASSUMPTIONS.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold-muted" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="min-w-0 space-y-5">
        {state.kind === 'idle' && (
          <div className="panel border-dashed p-6 text-center">
            <p className="text-sm text-fg-muted">No placement evaluated yet.</p>
            <p className="mt-1 text-xs text-fg-faint">
              Select Evaluate placements to score every candidate and compare three placement methods.
            </p>
          </div>
        )}

        {state.kind === 'loading' && (
          <div className="panel p-4" role="status">
            <p className="text-sm text-fg-muted">Scoring candidates and running the optimisers…</p>
            <div className="loading-bar mt-3 h-px bg-line" />
          </div>
        )}

        {state.kind === 'done' && (
          <>
            {!state.evaluation.greedy.ok ? (
              <div className="notice-error" role="alert">
                <p className="notice-error-title">Candidate scoring failed</p>
                <p className="mt-1 text-sm text-fg-muted">{state.evaluation.greedy.error}</p>
              </div>
            ) : (
              <GreedyPanel network={network} result={state.evaluation.greedy.value} />
            )}

            <section className="panel overflow-x-auto">
              <div className="border-b border-line px-4 py-3">
                <h2 className="panel-title">Method comparison</h2>
                <p className="panel-subtitle">
                  Route coverage = placements that intersect each of the three cheapest routes.
                </p>
              </div>
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Placement</th>
                    <th>Objective</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">Route coverage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-fg">
                    <td>Greedy deception score</td>
                    {state.evaluation.greedy.ok ? (
                      <>
                        <td className="text-warn">{state.evaluation.greedy.value.honeypots.join(', ') || '—'}</td>
                        <td className="text-xs text-fg-muted">Top-k per-node score</td>
                        <td className="text-right font-mono tabular-nums">
                          {state.evaluation.greedy.value.honeypot_scores
                            .filter((row) => row.selected)
                            .map((row) => row.deception_score)
                            .join(' · ')}
                        </td>
                        <td className="text-right font-mono">{coverage(state.evaluation.greedy.value.honeypots)}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="text-bad">{state.evaluation.greedy.error}</td>
                    )}
                  </tr>
                  <OptimiserRow name="Hill Climbing" result={state.evaluation.hillClimbing} coverage={coverage} />
                  <OptimiserRow name="Genetic Algorithm" result={state.evaluation.genetic} coverage={coverage} />
                </tbody>
              </table>
              <FitnessBreakdown evaluation={state.evaluation} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function GreedyPanel({ network, result }: { network: NetworkResponse; result: SimulationResponse }) {
  const maxScore = Math.max(0, ...result.honeypot_scores.map((row) => row.deception_score)) || 1
  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="eyebrow">Recommended placement · greedy deception score</p>
          <h2 className="mt-0.5 text-sm font-semibold text-gold-champagne">
            {result.honeypots.length > 0 ? result.honeypots.join(', ') : 'No honeypots placed'}
          </h2>
        </div>
        <span
          className={`badge ${result.result === 'intercepted' ? 'border-ok/40 text-ok' : result.result === 'target_reached' ? 'border-bad/40 text-bad' : 'border-line-strong text-fg-muted'}`}
        >
          {result.result === 'intercepted'
            ? `Intercepts ${result.algorithm} route at ${result.intercepted_at}`
            : result.result === 'target_reached'
              ? `${result.algorithm} route not intercepted`
              : 'No route to target'}
        </span>
      </div>

      <div className="grid gap-5 p-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto">
          <h3 className="eyebrow">Candidate locations</h3>
          <table className="data-table mt-1.5 min-w-[380px]">
            <thead>
              <tr>
                <th>Candidate</th>
                <th className="text-right" title="Routes through the node, out of the four algorithms">Freq</th>
                <th className="text-right">Prox</th>
                <th className="text-right">Deg</th>
                <th className="text-right">Cost</th>
                <th className="w-28">Score</th>
              </tr>
            </thead>
            <tbody>
              {result.honeypot_scores.map((row) => (
                <tr key={row.node} className={row.selected ? 'text-fg' : 'text-fg-muted'}>
                  <td>
                    <span className="flex items-center gap-1.5">
                      {row.selected && <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-label="selected" />}
                      {row.node}
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
                      <span className="w-10 text-right font-mono text-xs tabular-nums">{row.deception_score}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 font-mono text-2xs text-fg-faint">
            score = (freq + prox + deg) ÷ cost — higher is better
          </p>
        </div>

        <div className="min-w-0">
          <h3 className="eyebrow">Placement on the network</h3>
          <div className="mt-1.5">
            <NetworkGraph
              network={network}
              path={result.path}
              honeypots={result.honeypots}
              startNode={result.start_node}
              targetNode={result.target_node}
              heightClass="h-[300px]"
            />
          </div>
          <div className="mt-2">
            <GraphLegend />
          </div>
        </div>
      </div>
    </section>
  )
}

function OptimiserRow({
  name,
  result,
  coverage,
}: {
  name: string
  result: Settled<AIAnalyzeResponse>
  coverage: (placement: string[]) => string
}) {
  if (!result.ok) {
    return (
      <tr>
        <td>{name}</td>
        <td colSpan={4} className="text-bad">
          {result.error}
        </td>
      </tr>
    )
  }
  return (
    <tr className="text-fg-soft">
      <td>{name}</td>
      <td className="text-warn">{result.value.honeypots.join(', ') || '—'}</td>
      <td className="text-xs text-fg-muted">Placement fitness</td>
      <td className="text-right font-mono tabular-nums">{result.value.score}</td>
      <td className="text-right font-mono">{coverage(result.value.honeypots)}</td>
    </tr>
  )
}

function FitnessBreakdown({ evaluation }: { evaluation: Evaluation }) {
  const rows = [
    ['Hill Climbing', evaluation.hillClimbing],
    ['Genetic Algorithm', evaluation.genetic],
  ] as const
  const ready = rows.filter(([, result]) => result.ok)
  if (ready.length === 0) return null

  return (
    <div className="border-t border-line px-4 py-3">
      <h3 className="eyebrow">Fitness components (normalised, before weighting)</h3>
      <table className="data-table mt-1.5 min-w-[560px]">
        <thead>
          <tr>
            <th>Method</th>
            <th className="text-right">Coverage</th>
            <th className="text-right">Proximity</th>
            <th className="text-right">Criticality</th>
            <th className="text-right">Deception</th>
            <th className="text-right">Total cost</th>
          </tr>
        </thead>
        <tbody>
          {ready.map(([name, result]) => {
            if (!result.ok) return null
            const parts = components(result.value)
            return (
              <tr key={name} className="text-fg-soft">
                <td>{name}</td>
                <td className="text-right font-mono tabular-nums">{parts.coverage ?? '—'}</td>
                <td className="text-right font-mono tabular-nums">{parts.proximity ?? '—'}</td>
                <td className="text-right font-mono tabular-nums">{parts.criticality ?? '—'}</td>
                <td className="text-right font-mono tabular-nums">{parts.deception ?? '—'}</td>
                <td className="text-right font-mono tabular-nums">{parts.cost ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
