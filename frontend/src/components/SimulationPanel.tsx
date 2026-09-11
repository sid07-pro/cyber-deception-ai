/**
 * SimulationPanel.tsx
 * Orchestrates the simulation workspace: network graph, controls, result,
 * and this session's recent runs.
 */

import { useEffect, useState } from 'react'
import { getNetwork, runSimulation } from '../api/client'
import type { NetworkResponse, SimulationResponse } from '../api/types'
import { NetworkGraph } from './NetworkGraph'
import { HistoryList, type HistoryEntry } from './HistoryList'
import { ResultPanel } from './ResultPanel'
import { SimulationControls, type SimulationSettings } from './SimulationControls'

type NetworkState =
  | { kind: 'loading' }
  | { kind: 'ready'; network: NetworkResponse }
  | { kind: 'error'; message: string }

type RunState = { kind: 'idle' } | { kind: 'running' } | { kind: 'error'; message: string }

const MAX_HISTORY = 8

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function SimulationPanel() {
  const [networkState, setNetworkState] = useState<NetworkState>({ kind: 'loading' })
  const [runState, setRunState] = useState<RunState>({ kind: 'idle' })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [settings, setSettings] = useState<SimulationSettings>({
    algorithm: 'A*',
    startNode: '',
    targetNode: '',
    honeypotCount: 2,
  })

  useEffect(() => {
    const controller = new AbortController()

    getNetwork(controller.signal)
      .then((network) => {
        setNetworkState({ kind: 'ready', network })
        setSettings((current) => ({
          ...current,
          startNode: network.attacker_start,
          targetNode: network.critical_target,
        }))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNetworkState({ kind: 'error', message: errorMessage(error) })
      })

    return () => controller.abort()
  }, [])

  const handleRun = () => {
    setRunState({ kind: 'running' })
    runSimulation({
      algorithm: settings.algorithm,
      start_node: settings.startNode,
      target_node: settings.targetNode,
      honeypot_count: settings.honeypotCount,
    })
      .then((result) => {
        const entry: HistoryEntry = {
          id: Date.now(),
          ranAt: new Date().toLocaleTimeString(),
          result,
        }
        // Session-only history; nothing is persisted anywhere.
        setHistory((current) => [entry, ...current].slice(0, MAX_HISTORY))
        setSelectedId(entry.id)
        setRunState({ kind: 'idle' })
      })
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
  const selected = history.find((entry) => entry.id === selectedId) ?? null
  const result: SimulationResponse | null = selected?.result ?? null

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-100">Network topology</h2>
          <p className="text-sm text-slate-400">
            Attacker start <span className="text-slate-200">{network.attacker_start}</span> ·
            critical asset <span className="text-slate-200">{network.critical_target}</span>
          </p>
        </div>
        <NetworkGraph
          network={network}
          path={result?.path ?? []}
          honeypots={result?.honeypots ?? []}
        />
      </section>

      <SimulationControls
        nodeNames={network.nodes.map((node) => node.name)}
        settings={settings}
        onChange={setSettings}
        onRun={handleRun}
        isRunning={runState.kind === 'running'}
      />

      {runState.kind === 'error' && (
        <div className="rounded-lg border border-red-800 bg-slate-900 p-4">
          <p className="font-semibold text-red-400">Simulation failed</p>
          <p className="mt-1 text-sm text-slate-400">{runState.message}</p>
        </div>
      )}

      {runState.kind === 'running' && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-slate-400">Running simulation…</p>
        </div>
      )}

      {result ? (
        <ResultPanel result={result} />
      ) : (
        runState.kind === 'idle' && (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-slate-400">
              No result yet. Choose a strategy and select Run Simulation.
            </p>
          </div>
        )
      )}

      <HistoryList entries={history} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  )
}
