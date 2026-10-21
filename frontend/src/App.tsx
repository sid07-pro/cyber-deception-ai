/**
 * App.tsx
 * Application shell: navigation, the shared network and scenario settings,
 * and the active section.
 *
 * Sections are switched in place rather than routed, which keeps the single
 * bundle dependency-free while still giving each area its own page.
 */

import { useEffect, useState } from 'react'
import { getNetwork, isApiBaseUrlMissing, MISSING_API_URL_MESSAGE } from './api/client'
import type { NetworkResponse } from './api/types'
import { AdvancedAIPanel } from './components/AdvancedAIPanel'
import { ExperimentLab } from './components/ExperimentLab'
import { PlanningPanel } from './components/PlanningPanel'
import { SimulationPanel } from './components/SimulationPanel'
import type { SimulationSettings } from './components/SimulationControls'
import { AboutPage } from './pages/AboutPage'
import { DashboardPage } from './pages/DashboardPage'
import { ScenariosPage } from './pages/ScenariosPage'

const SECTIONS = [
  'Dashboard',
  'Simulation',
  'Advanced AI',
  'Planning',
  'Experiment Lab',
  'Saved Scenarios',
  'About',
] as const

type Section = (typeof SECTIONS)[number]

type NetworkState =
  | { kind: 'loading' }
  | { kind: 'ready'; network: NetworkResponse }
  | { kind: 'error'; message: string }

export default function App() {
  const [section, setSection] = useState<Section>('Dashboard')
  const [networkState, setNetworkState] = useState<NetworkState>({ kind: 'loading' })
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
        setNetworkState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      })

    return () => controller.abort()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-2xl font-bold text-emerald-400">Cyber Deception AI</h1>
          <p className="mt-1 text-slate-400">
            Intelligent honeypot placement &amp; attacker path prediction — simulation only.
          </p>

          <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSection(name)}
                aria-current={section === name ? 'page' : undefined}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  section === name
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                {name}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {isApiBaseUrlMissing() && (
        <div className="border-b border-amber-800 bg-amber-950/40">
          <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-amber-300">
            <strong className="font-semibold">Backend not configured.</strong>{' '}
            {MISSING_API_URL_MESSAGE}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Content
          section={section}
          networkState={networkState}
          settings={settings}
          onSettingsChange={setSettings}
        />
      </main>
    </div>
  )
}

interface ContentProps {
  section: Section
  networkState: NetworkState
  settings: SimulationSettings
  onSettingsChange: (settings: SimulationSettings) => void
}

function Content({ section, networkState, settings, onSettingsChange }: ContentProps) {
  // Saved Scenarios and About do not need the live network.
  if (section === 'Saved Scenarios') return <ScenariosPage />
  if (section === 'About') return <AboutPage />

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
        <p className="mt-2 text-sm text-slate-500">
          Check that the backend is running and reachable at /api.
        </p>
      </div>
    )
  }

  const { network } = networkState

  switch (section) {
    case 'Dashboard':
      return <DashboardPage network={network} />
    case 'Simulation':
      return (
        <SimulationPanel
          network={network}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      )
    case 'Advanced AI':
      return <AdvancedAIPanel settings={settings} />
    case 'Planning':
      return <PlanningPanel settings={settings} />
    case 'Experiment Lab':
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
