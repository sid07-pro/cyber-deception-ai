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
import { GraphLegend, NetworkGraph } from './NetworkGraph'
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
  /** Lifted history (shared with the dashboard); falls back to local state. */
  history?: HistoryEntry[]
  onRecord?: (entry: HistoryEntry) => void
}

export function SimulationPanel({
  network,
  settings,
  onSettingsChange,
  history: sharedHistory,
  onRecord,
}: SimulationPanelProps) {
  const [runState, setRunState] = useState<RunState>({ kind: 'idle' })
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(sharedHistory?.[0]?.id ?? null)
  const [session, setSession] = useState<SimulationStateResponse | null>(null)
  const [isSessionBusy, setSessionBusy] = useState(false)

  const history = sharedHistory ?? localHistory

  const handleRun = () => {
    setRunState({ kind: 'running' })
    // A one-shot run takes over the graph from any stepped session.
    setSession(null)
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
        if (onRecord) onRecord(entry)
        else setLocalHistory((current) => [entry, ...current].slice(0, MAX_HISTORY))
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

  const graphSource = session
    ? `Stepped session · step ${session.time_step}`
    : result
      ? `${result.algorithm} result · ${selected?.ranAt ?? ''}`
      : 'No analysis yet'

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-5">
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

        <HistoryList
          entries={history}
          selectedId={selectedId}
          onSelect={(id) => {
            setSession(null)
            setSelectedId(id)
          }}
        />
      </div>

      <div className="min-w-0 space-y-5">
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="panel-title">Network topology</h2>
              <p className="panel-subtitle">
                Entry <span className="text-fg-soft">{settings.startNode || network.attacker_start}</span>
                {' · '}target <span className="text-fg-soft">{settings.targetNode || network.critical_target}</span>
              </p>
            </div>
            <span className="eyebrow">{graphSource}</span>
          </div>
          <div className="p-3">
            <NetworkGraph
              network={network}
              startNode={settings.startNode}
              targetNode={settings.targetNode}
              {...highlight}
            />
            <div className="mt-3 px-1">
              <GraphLegend />
            </div>
          </div>
        </section>

        {runState.kind === 'error' && (
          <div className="notice-error" role="alert">
            <p className="notice-error-title">Simulation failed</p>
            <p className="mt-1 text-sm text-fg-muted">{runState.message}</p>
          </div>
        )}

        {runState.kind === 'running' && (
          <div className="panel p-4" role="status">
            <p className="text-sm text-fg-muted">Running simulation…</p>
            <div className="loading-bar mt-3 h-px bg-line" />
          </div>
        )}

        {session && session.explanation.length > 0 && (
          <section className="panel p-4">
            <h2 className="panel-title">Agent decisions</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg-soft marker:text-gold-muted">
              {session.explanation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}

        {session && <EventTimeline events={session.events} />}

        {result && !session ? (
          <ResultPanel result={result} />
        ) : (
          runState.kind === 'idle' &&
          !session && (
            <div className="panel border-dashed p-6 text-center">
              <p className="text-sm text-fg-muted">
                No result yet. Choose a strategy and select Run Simulation.
              </p>
              <p className="mt-1 text-xs text-fg-faint">
                The attacker route, deception scoring, and alternative routes appear here.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
