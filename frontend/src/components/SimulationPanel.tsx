/**
 * SimulationPanel.tsx
 * Loads the network, lets the user pick a search strategy and endpoints,
 * runs the simulation against the backend, and renders the result.
 */

import { useEffect, useState } from 'react'
import { getNetwork, runSimulation } from '../api/client'
import {
  SEARCH_ALGORITHMS,
  type NetworkResponse,
  type SearchAlgorithm,
  type SimulationResponse,
} from '../api/types'
import { NetworkView } from './NetworkView'

type NetworkState =
  | { kind: 'loading' }
  | { kind: 'ready'; network: NetworkResponse }
  | { kind: 'error'; message: string }

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: SimulationResponse }
  | { kind: 'error'; message: string }

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function SimulationPanel() {
  const [networkState, setNetworkState] = useState<NetworkState>({ kind: 'loading' })
  const [runState, setRunState] = useState<RunState>({ kind: 'idle' })

  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('A*')
  const [startNode, setStartNode] = useState('')
  const [targetNode, setTargetNode] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    getNetwork(controller.signal)
      .then((network) => {
        setNetworkState({ kind: 'ready', network })
        setStartNode(network.attacker_start)
        setTargetNode(network.critical_target)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNetworkState({ kind: 'error', message: errorMessage(error) })
      })

    return () => controller.abort()
  }, [])

  const handleRun = () => {
    setRunState({ kind: 'running' })
    runSimulation({ algorithm, start_node: startNode, target_node: targetNode })
      .then((result) => setRunState({ kind: 'done', result }))
      .catch((error: unknown) => setRunState({ kind: 'error', message: errorMessage(error) }))
  }

  if (networkState.kind === 'loading') {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-slate-400">Loading network…</p>
      </div>
    )
  }

  if (networkState.kind === 'error') {
    return (
      <div className="rounded-lg border border-red-800 bg-slate-900 p-4">
        <p className="font-semibold text-red-400">Could not load the network</p>
        <p className="mt-1 text-sm text-slate-400">{networkState.message}</p>
      </div>
    )
  }

  const { network } = networkState
  const nodeNames = network.nodes.map((node) => node.name)

  return (
    <div className="space-y-6">
      <NetworkView network={network} />

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <h2 className="font-semibold text-slate-100">Run a simulation</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-slate-400">Algorithm</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value as SearchAlgorithm)}
            >
              {SEARCH_ALGORITHMS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="text-slate-400">Start node</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
              value={startNode}
              onChange={(event) => setStartNode(event.target.value)}
            >
              {nodeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="text-slate-400">Target node</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
              value={targetNode}
              onChange={(event) => setTargetNode(event.target.value)}
            >
              {nodeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={runState.kind === 'running'}
          className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {runState.kind === 'running' ? 'Running…' : 'Run Simulation'}
        </button>

        {runState.kind === 'error' && (
          <div className="mt-4 rounded border border-red-800 bg-slate-950 p-3">
            <p className="font-semibold text-red-400">Simulation failed</p>
            <p className="mt-1 text-sm text-slate-400">{runState.message}</p>
          </div>
        )}
      </section>

      {runState.kind === 'done' && <SimulationResult result={runState.result} />}
    </div>
  )
}

function SimulationResult({ result }: { result: SimulationResponse }) {
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
