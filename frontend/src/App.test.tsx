/**
 * App.test.tsx
 * Covers navigation between sections and the shell's network loading states.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import type { NetworkResponse } from './api/types'

const getNetwork = vi.fn()

vi.mock('./api/client', () => ({
  getNetwork: (...args: unknown[]) => getNetwork(...args),
  getHealth: vi.fn().mockResolvedValue({ status: 'ok', service: 'cyber-deception-ai', version: '0.1.0' }),
  runSimulation: vi.fn(),
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

    expect(await screen.findByText('Where to go next')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    for (const section of [
      'Simulation',
      'Advanced AI',
      'Planning',
      'Experiment Lab',
      'Saved Scenarios',
      'About',
    ]) {
      expect(screen.getByRole('button', { name: section })).toBeInTheDocument()
    }
  })

  it('switches sections and marks the active one', async () => {
    render(<App />)
    await screen.findByText('Where to go next')

    navTo('Simulation')
    expect(screen.getByText('Simulation controls')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simulation' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    navTo('Advanced AI')
    expect(screen.getByText('Advanced AI analysis')).toBeInTheDocument()

    navTo('Planning')
    expect(screen.getByText('Defensive planning')).toBeInTheDocument()

    navTo('Experiment Lab')
    expect(screen.getByText('Experiment lab')).toBeInTheDocument()

    navTo('About')
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
    navTo('About')
    expect(screen.getByText('Simulation only')).toBeInTheDocument()
  })
})
