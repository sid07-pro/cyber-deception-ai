/**
 * SimulationPanel.test.tsx
 * Covers the simulation workspace: controls render, a successful run, and errors.
 * The React Flow graph is stubbed — it needs real layout measurement.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NetworkResponse, SimulationResponse } from '../api/types'
import { SimulationPanel } from './SimulationPanel'

vi.mock('./NetworkGraph', () => ({
  NetworkGraph: () => <div data-testid="network-graph" />,
}))

const getNetwork = vi.fn()
const runSimulation = vi.fn()

vi.mock('../api/client', () => ({
  getNetwork: (...args: unknown[]) => getNetwork(...args),
  runSimulation: (...args: unknown[]) => runSimulation(...args),
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

const RESULT: SimulationResponse = {
  algorithm: 'BFS',
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
  explanation: ['The attacker agent used BFS and was intercepted.'],
}

beforeEach(() => {
  getNetwork.mockResolvedValue(NETWORK)
  runSimulation.mockResolvedValue(RESULT)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SimulationPanel', () => {
  it('renders the simulation controls once the network loads', async () => {
    render(<SimulationPanel />)

    expect(await screen.findByRole('combobox', { name: 'Algorithm' })).toHaveValue('A*')
    expect(screen.getByRole('combobox', { name: 'Start node' })).toHaveValue('Internet')
    expect(screen.getByRole('combobox', { name: 'Target node' })).toHaveValue('Database')
    expect(screen.getByRole('combobox', { name: 'Honeypots' })).toHaveValue('2')
    expect(screen.getByRole('button', { name: 'Run Simulation' })).toBeEnabled()
    expect(screen.getByText(/No result yet/i)).toBeInTheDocument()
    expect(screen.getByText(/No simulations yet/i)).toBeInTheDocument()
  })

  it('shows the result and records history after a successful run', async () => {
    render(<SimulationPanel />)

    fireEvent.click(await screen.findByRole('button', { name: 'Run Simulation' }))

    expect(await screen.findByText('Attacker intercepted by a honeypot')).toBeInTheDocument()
    expect(screen.getByText('Internet → Web Server → Database')).toBeInTheDocument()
    expect(screen.getByText('6', { selector: 'dd' })).toBeInTheDocument()
    // The honeypots row, not the node dropdown options.
    expect(screen.getByText('Web Server', { selector: 'dd' })).toBeInTheDocument()
    expect(
      screen.getByText('The attacker agent used BFS and was intercepted.'),
    ).toBeInTheDocument()

    // The run is listed in this session's history and selected.
    const historyEntry = await screen.findByRole('button', {
      name: /BFS · Internet → Database/,
    })
    expect(historyEntry).toHaveAttribute('aria-current', 'true')

    expect(runSimulation).toHaveBeenCalledWith({
      algorithm: 'A*',
      start_node: 'Internet',
      target_node: 'Database',
      honeypot_count: 2,
    })
  })

  it('shows an error state when the simulation request fails', async () => {
    runSimulation.mockRejectedValue(new Error("Unknown node 'Mainframe'."))
    render(<SimulationPanel />)

    fireEvent.click(await screen.findByRole('button', { name: 'Run Simulation' }))

    expect(await screen.findByText('Simulation failed')).toBeInTheDocument()
    expect(screen.getByText("Unknown node 'Mainframe'.")).toBeInTheDocument()
  })

  it('shows an error state when the network cannot be loaded', async () => {
    getNetwork.mockRejectedValue(new Error('Backend unreachable'))
    render(<SimulationPanel />)

    await waitFor(() =>
      expect(screen.getByText('Could not load the network')).toBeInTheDocument(),
    )
    expect(screen.getByText('Backend unreachable')).toBeInTheDocument()
  })
})
