/**
 * App.test.tsx
 * Covers navigation between sections, the shell's network loading states,
 * and the dashboard reflecting runs made on the analysis page.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import type { NetworkResponse } from './api/types'

const getNetwork = vi.fn()
const runSimulation = vi.fn()

vi.mock('./api/client', () => ({
  getNetwork: (...args: unknown[]) => getNetwork(...args),
  isApiBaseUrlMissing: () => false,
  MISSING_API_URL_MESSAGE: 'set VITE_API_BASE_URL',
  getHealth: vi.fn().mockResolvedValue({ status: 'ok', service: 'cyber-deception-ai', version: '0.1.0' }),
  runSimulation: (...args: unknown[]) => runSimulation(...args),
  startSession: vi.fn(),
  stepSession: vi.fn(),
  resetSession: vi.fn(),
  analyzeWithAI: vi.fn(),
  createPlan: vi.fn(),
  runExperiment: vi.fn(),
  saveExperiment: vi.fn(),
  saveCurrentNetwork: vi.fn(),
  listScenarios: vi.fn().mockResolvedValue([]),
  deleteScenario: vi.fn(),
  listStoredExperiments: vi.fn().mockResolvedValue([]),
}))

// The React Flow graph needs real layout measurement.
vi.mock('./components/NetworkGraph', () => ({
  NetworkGraph: () => <div data-testid="network-graph" />,
  GraphLegend: () => null,
}))

const NETWORK: NetworkResponse = {
  nodes: [
    { id: 'Internet', name: 'Internet', type: 'normal', criticality: 'low', metadata: {} },
    {
      id: 'Web Server',
      name: 'Web Server',
      type: 'honeypot_candidate',
      criticality: 'medium',
      metadata: {},
    },
    { id: 'Database', name: 'Database', type: 'critical', criticality: 'high', metadata: {} },
  ],
  edges: [
    { source: 'Internet', target: 'Web Server', weight: 1 },
    { source: 'Web Server', target: 'Database', weight: 5 },
  ],
  attacker_start: 'Internet',
  critical_target: 'Database',
  honeypot_candidates: ['Web Server'],
}

beforeEach(() => {
  getNetwork.mockResolvedValue(NETWORK)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function navTo(name: string) {
  fireEvent.click(screen.getByRole('button', { name, current: false }))
}

describe('App navigation', () => {
  it('opens on the dashboard with every section reachable', async () => {
    render(<App />)

    expect(await screen.findByText('Analysis modules')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    for (const section of [
      'Network Topology',
      'Attack Path Analysis',
      'Honeypot Placement',
      'Advanced Analysis',
      'Defense Planning',
      'Experiment Lab',
      'Saved Scenarios',
      'Methodology',
    ]) {
      expect(screen.getByRole('button', { name: section })).toBeInTheDocument()
    }
  })

  it('switches sections and marks the active one', async () => {
    render(<App />)
    await screen.findByText('Analysis modules')

    navTo('Attack Path Analysis')
    expect(screen.getByText('Analysis configuration')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attack Path Analysis' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    navTo('Network Topology')
    expect(screen.getByText('Asset properties')).toBeInTheDocument()

    navTo('Honeypot Placement')
    expect(screen.getByText('Placement configuration')).toBeInTheDocument()

    navTo('Advanced Analysis')
    expect(screen.getByText('Advanced AI analysis')).toBeInTheDocument()

    navTo('Defense Planning')
    expect(screen.getByText('Defensive planning')).toBeInTheDocument()

    navTo('Experiment Lab')
    expect(screen.getByText('Experiment lab')).toBeInTheDocument()

    navTo('Methodology')
    expect(screen.getByText('Simulation only')).toBeInTheDocument()
  })

  it('shows the shell error state when the network cannot be loaded', async () => {
    getNetwork.mockRejectedValue(new Error('Backend unreachable'))
    render(<App />)

    await waitFor(() =>
      expect(screen.getByText('Could not load the network')).toBeInTheDocument(),
    )
    expect(screen.getByText('Backend unreachable')).toBeInTheDocument()

    // Saved Scenarios and About do not depend on the network.
    navTo('Methodology')
    expect(screen.getByText('Simulation only')).toBeInTheDocument()
  })

  it('shows real metrics and an empty state before any run, then the latest result', async () => {
    runSimulation.mockResolvedValue({
      algorithm: 'UCS',
      start_node: 'Internet',
      target_node: 'Database',
      path: ['Internet', 'Web Server', 'Database'],
      path_cost: 6,
      nodes_explored: 3,
      honeypots: ['Web Server'],
      honeypot_scores: [],
      result: 'intercepted',
      intercepted_at: 'Web Server',
      intercepted_at_step: 1,
      algorithm_comparison: [],
      explanation: ['UCS found the cheapest route.'],
    })
    render(<App />)

    expect(await screen.findByText('No simulation has run yet.')).toBeInTheDocument()
    expect(screen.getByText('Modelled hosts').nextSibling).toHaveTextContent('3')

    navTo('Attack Path Analysis')
    fireEvent.click(screen.getByRole('button', { name: 'Run Simulation' }))
    await screen.findByText('Attacker intercepted by a honeypot')

    navTo('Dashboard')
    expect(screen.queryByText('No simulation has run yet.')).not.toBeInTheDocument()
    expect(screen.getByText('Latest result')).toBeInTheDocument()
    expect(screen.getByText('Intercepted')).toBeInTheDocument()
  })
})
