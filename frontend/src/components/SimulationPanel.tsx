/**
 * SimulationPanel.tsx
 * The simulation workspace: network graph, controls, stepped session,
 * result, event timeline, and this session's recent runs.
 *
 * The network and the shared scenario settings are owned by App, so every
 * page works against the same start node, target, and honeypot budget.
 */

import { useState } from 'react'
import { resetSession, runSimulation, startSession, stepSession } from '../api/client'
import type {
  NetworkResponse,
  SimulationResponse,
  SimulationStateResponse,
} from '../api/types'
import { EventTimeline } from './EventTimeline'
import { NetworkGraph } from './NetworkGraph'
import { HistoryList, type HistoryEntry } from './HistoryList'
import { ResultPanel } from './ResultPanel'
import { SimulationControls, type SimulationSettings } from './SimulationControls'
import { StepControls } from './StepControls'

type RunState = { kind: 'idle' } | { kind: 'running' } | { kind: 'error'; message: string }

const MAX_HISTORY = 8

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

interface SimulationPanelProps {
  network: NetworkResponse
  settings: SimulationSettings
  onSettingsChange: (settings: SimulationSettings) => void
}

export function SimulationPanel({
  network,
  settings,
  onSettingsChange,
}: SimulationPanelProps) {
  const [runState, setRunState] = useState<RunState>({ kind: 'idle' })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [session, setSession] = useState<SimulationStateResponse | null>(null)
  const [isSessionBusy, setSessionBusy] = useState(false)

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

  /** Shared wrapper for the three stepped-session calls. */
  const withSession = (action: () => Promise<SimulationStateResponse>) => {
    setSessionBusy(true)
    setRunState({ kind: 'idle' })
    action()
      .then(setSession)
      .catch((error: unknown) => setRunState({ kind: 'error', message: errorMessage(error) }))
      .finally(() => setSessionBusy(false))
  }

  const handleStart = () =>
    withSession(() =>
      startSession({
        algorithm: settings.algorithm,
        start_node: settings.startNode,
        target_node: settings.targetNode,
        honeypot_budget: settings.honeypotCount,
      }),
    )

  const handleStep = () => {
    if (!session) return
    withSession(() => stepSession(session.session_id))
  }

  const handleReset = () => {
    if (!session) return
    withSession(() => resetSession(session.session_id))
  }

  const selected = history.find((entry) => entry.id === selectedId) ?? null
  const result: SimulationResponse | null = selected?.result ?? null

  // A live stepped session drives the graph; otherwise the selected past run does.
  const highlight = session
    ? {
        path: session.predicted_path,
        honeypots: session.honeypots,
        visitedNodes: session.visited_nodes,
        attackerPosition: session.attacker_position,
      }
    : {
        path: result?.path ?? [],
        honeypots: result?.honeypots ?? [],
        visitedNodes: [],
        attackerPosition: null,
      }

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
        <NetworkGraph network={network} {...highlight} />
      </section>

      <SimulationControls
        nodeNames={network.nodes.map((node) => node.name)}
        settings={settings}
        onChange={onSettingsChange}
        onRun={handleRun}
        isRunning={runState.kind === 'running'}
      />

      <StepControls
        session={session}
        isBusy={isSessionBusy}
        onStart={handleStart}
        onStep={handleStep}
        onReset={handleReset}
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

      {session && session.explanation.length > 0 && (
        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-semibold text-slate-100">Agent decisions</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {session.explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <EventTimeline events={session?.events ?? []} />

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
