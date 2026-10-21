/**
 * App.tsx
 * Application shell: sidebar navigation, page header with real backend
 * status, the shared network and analysis settings, and the active page.
 *
 * Pages are switched in place rather than routed, which keeps the single
 * bundle dependency-free while still giving each area its own page.
 */

import { useEffect, useState } from 'react'
import { getNetwork, isApiBaseUrlMissing, MISSING_API_URL_MESSAGE } from './api/client'
import type { NetworkResponse } from './api/types'
import { AdvancedAIPanel } from './components/AdvancedAIPanel'
import { ExperimentLab } from './components/ExperimentLab'
import { BackendStatusPill, useBackendHealth } from './components/HealthStatus'
import type { HistoryEntry } from './components/HistoryList'
import { BrandMark, NavIcons } from './components/icons'
import { PlanningPanel } from './components/PlanningPanel'
import { SimulationPanel } from './components/SimulationPanel'
import type { SimulationSettings } from './components/SimulationControls'
import { AboutPage } from './pages/AboutPage'
import { DashboardPage } from './pages/DashboardPage'
import { HoneypotPlacementPage } from './pages/HoneypotPlacementPage'
import { NetworkTopologyPage } from './pages/NetworkTopologyPage'
import { ScenariosPage } from './pages/ScenariosPage'

export type PageId =
  | 'dashboard'
  | 'topology'
  | 'path'
  | 'honeypot'
  | 'advanced'
  | 'planning'
  | 'experiments'
  | 'scenarios'
  | 'methodology'

interface PageMeta {
  id: PageId
  label: string
  description: string
}

const NAV: { group: string; pages: PageMeta[] }[] = [
  {
    group: 'Overview',
    pages: [
      { id: 'dashboard', label: 'Dashboard', description: 'Modelled network and latest analysis results' },
      { id: 'topology', label: 'Network Topology', description: 'Inspect hosts, links, and asset properties' },
    ],
  },
  {
    group: 'Analysis',
    pages: [
      { id: 'path', label: 'Attack Path Analysis', description: 'Search for the attacker route and test the deception' },
      { id: 'honeypot', label: 'Honeypot Placement', description: 'Candidate scoring and optimised placements' },
      { id: 'advanced', label: 'Advanced Analysis', description: 'Game search, Bayesian risk, and placement optimisers' },
      { id: 'planning', label: 'Defense Planning', description: 'Forward and backward state-space plans' },
    ],
  },
  {
    group: 'Evaluation',
    pages: [
      { id: 'experiments', label: 'Experiment Lab', description: 'Repeated runs and placement-strategy comparison' },
      { id: 'scenarios', label: 'Saved Scenarios', description: 'Persisted topologies and experiment history' },
    ],
  },
  {
    group: 'Reference',
    pages: [{ id: 'methodology', label: 'Methodology', description: 'Techniques, metrics, and limitations' }],
  },
]

const PAGES = NAV.flatMap(({ group, pages }) => pages.map((page) => ({ ...page, group })))

type NetworkState =
  | { kind: 'loading' }
  | { kind: 'ready'; network: NetworkResponse }
  | { kind: 'error'; message: string }

const MAX_HISTORY = 8

export default function App() {
  const [page, setPage] = useState<PageId>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [networkState, setNetworkState] = useState<NetworkState>({ kind: 'loading' })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [settings, setSettings] = useState<SimulationSettings>({
    algorithm: 'A*',
    startNode: '',
    targetNode: '',
    honeypotCount: 2,
  })
  const health = useBackendHealth()

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
        setNetworkState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      })

    return () => controller.abort()
  }, [])

  const navigate = (id: PageId) => {
    setPage(id)
    setMenuOpen(false)
  }

  const current = PAGES.find((meta) => meta.id === page) ?? PAGES[0]

  return (
    <div className="min-h-screen bg-ink text-fg lg:flex">
      <Sidebar page={page} open={menuOpen} onNavigate={navigate} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="btn-ghost lg:hidden"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <NavIcons.menu />
            </button>
            <div className="min-w-0 flex-1">
              <p className="eyebrow truncate" aria-label="Breadcrumb">
                Cyber Deception AI <span className="text-line-strong">/</span> {current.group}
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-fg">
                {current.label}
              </h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span
                className="badge border-gold-muted/50 text-gold"
                title="All hosts, links, and events are synthetic. Nothing touches a real network."
              >
                Simulated environment
              </span>
              <BackendStatusPill state={health.state} onRetry={health.refresh} />
            </div>
          </div>
          <p className="hidden px-6 pb-3 text-xs text-fg-faint sm:block">{current.description}</p>
        </header>

        {isApiBaseUrlMissing() && (
          <div className="border-b border-warn/40 bg-warn/10">
            <p className="px-6 py-3 text-sm text-warn">
              <strong className="font-semibold">Backend not configured.</strong>{' '}
              {MISSING_API_URL_MESSAGE}
            </p>
          </div>
        )}

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <Content
            page={page}
            networkState={networkState}
            settings={settings}
            onSettingsChange={setSettings}
            history={history}
            onRecord={(entry) => setHistory((items) => [entry, ...items].slice(0, MAX_HISTORY))}
            onNavigate={navigate}
            health={health.state}
          />
        </main>
      </div>
    </div>
  )
}

function Sidebar({
  page,
  open,
  onNavigate,
}: {
  page: PageId
  open: boolean
  onNavigate: (id: PageId) => void
}) {
  return (
    <aside
      className={`${
        open ? 'block' : 'hidden'
      } border-b border-line bg-rail lg:sticky lg:top-0 lg:block lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r`}
    >
      <div className="flex items-center gap-2.5 px-5 py-4">
        <BrandMark />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-fg">Cyber Deception AI</p>
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-fg-faint">Deception lab</p>
        </div>
      </div>

      <nav aria-label="Sections" className="space-y-5 px-3 pb-6 pt-2">
        {NAV.map(({ group, pages }) => (
          <div key={group}>
            <p className="eyebrow px-2 pb-1.5">{group}</p>
            <ul className="space-y-0.5">
              {pages.map((meta) => {
                const Icon = NavIcons[meta.id]
                const active = meta.id === page
                return (
                  <li key={meta.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(meta.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors duration-150 ${
                        active
                          ? 'bg-raised text-fg'
                          : 'text-fg-muted hover:bg-raised/60 hover:text-fg'
                      }`}
                    >
                      <span
                        className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full transition-colors ${
                          active ? 'bg-gold' : 'bg-transparent'
                        }`}
                        aria-hidden
                      />
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? 'text-gold' : 'text-fg-faint group-hover:text-fg-muted'
                        }`}
                      />
                      {meta.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}

interface ContentProps {
  page: PageId
  networkState: NetworkState
  settings: SimulationSettings
  onSettingsChange: (settings: SimulationSettings) => void
  history: HistoryEntry[]
  onRecord: (entry: HistoryEntry) => void
  onNavigate: (id: PageId) => void
  health: ReturnType<typeof useBackendHealth>['state']
}

function Content({
  page,
  networkState,
  settings,
  onSettingsChange,
  history,
  onRecord,
  onNavigate,
  health,
}: ContentProps) {
  // Saved Scenarios and Methodology do not need the live network.
  if (page === 'scenarios') return <ScenariosPage />
  if (page === 'methodology') return <AboutPage />

  if (networkState.kind === 'loading') {
    return (
      <div className="panel p-4" role="status">
        <p className="text-sm text-fg-muted">Loading network…</p>
        <div className="loading-bar mt-3 h-px bg-line" />
      </div>
    )
  }

  if (networkState.kind === 'error') {
    return (
      <div className="notice-error">
        <p className="notice-error-title">Could not load the network</p>
        <p className="mt-1 text-sm text-fg-muted">{networkState.message}</p>
        <p className="mt-2 text-sm text-fg-faint">
          Check that the backend is running and reachable at /api.
        </p>
      </div>
    )
  }

  const { network } = networkState

  switch (page) {
    case 'dashboard':
      return (
        <DashboardPage
          network={network}
          history={history}
          health={health}
          onNavigate={onNavigate}
        />
      )
    case 'topology':
      return (
        <NetworkTopologyPage
          network={network}
          settings={settings}
          onSettingsChange={onSettingsChange}
          onAnalyse={() => onNavigate('path')}
        />
      )
    case 'path':
      return (
        <SimulationPanel
          network={network}
          settings={settings}
          onSettingsChange={onSettingsChange}
          history={history}
          onRecord={onRecord}
        />
      )
    case 'honeypot':
      return (
        <HoneypotPlacementPage
          network={network}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      )
    case 'advanced':
      return <AdvancedAIPanel settings={settings} />
    case 'planning':
      return <PlanningPanel settings={settings} />
    case 'experiments':
      return (
        <ExperimentLab
          nodeNames={network.nodes.map((node) => node.name)}
          defaultStart={network.attacker_start}
          defaultTarget={network.critical_target}
        />
      )
    default:
      return null
  }
}
