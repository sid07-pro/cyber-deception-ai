/**
 * SimulationPanel.test.tsx
 * Covers the simulation workspace: controls render, a successful run, and errors.
 * The React Flow graph is stubbed — it needs real layout measurement.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  NetworkResponse,
  SimulationResponse,
  SimulationStateResponse,
} from '../api/types'
import { SimulationPanel } from './SimulationPanel'

vi.mock('./NetworkGraph', () => ({
  NetworkGraph: () => <div data-testid="network-graph" />,
}))

const getNetwork = vi.fn()
const runSimulation = vi.fn()
const startSession = vi.fn()
const stepSession = vi.fn()
const resetSession = vi.fn()

vi.mock('../api/client', () => ({
  getNetwork: (...args: unknown[]) => getNetwork(...args),
  runSimulation: (...args: unknown[]) => runSimulation(...args),
  startSession: (...args: unknown[]) => startSession(...args),
  stepSession: (...args: unknown[]) => stepSession(...args),
  resetSession: (...args: unknown[]) => resetSession(...args),
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

const SESSION: SimulationStateResponse = {
  session_id: 'session-1',
  algorithm: 'A*',
  start_node: 'Internet',
  target_node: 'Database',
  honeypot_budget: 2,
  predicted_path: ['Internet', 'Web Server', 'Database'],
  path_cost: 6,
  nodes_explored: 3,
  honeypots: ['Web Server'],
  honeypot_scores: [],
  attacker_position: 'Internet',
  path_index: 0,
  visited_nodes: ['Internet'],
  compromised_nodes: ['Internet'],
  time_step: 0,
  status: 'running',
  outcome: null,
  is_complete: false,
  current_event: { step: 0, kind: 'deploy', node: null, message: 'Honeypots deployed.' },
  events: [{ step: 0, kind: 'deploy', node: null, message: 'Honeypots deployed.' }],
  explanation: ['The attacker agent used A* and committed to its route.'],
  protection: { covered_nodes: 1, path_coverage: 0.333, risk_level: 'low' },
}

const INTERCEPTED: SimulationStateResponse = {
  ...SESSION,
  attacker_position: 'Web Server',
  path_index: 1,
  visited_nodes: ['Internet', 'Web Server'],
  time_step: 1,
  status: 'completed',
  outcome: 'intercepted',
  is_complete: true,
  current_event: {
    step: 1,
    kind: 'intercepted',
    node: 'Web Server',
    message: 'Web Server is a honeypot. The attacker was deceived.',
  },
  events: [
    ...SESSION.events,
    { step: 1, kind: 'move', node: 'Web Server', message: 'The attacker moved to Web Server.' },
    {
      step: 1,
      kind: 'intercepted',
      node: 'Web Server',
      message: 'Web Server is a honeypot. The attacker was deceived.',
    },
  ],
}

beforeEach(() => {
  getNetwork.mockResolvedValue(NETWORK)
  runSimulation.mockResolvedValue(RESULT)
  startSession.mockResolvedValue(SESSION)
  stepSession.mockResolvedValue(INTERCEPTED)
  resetSession.mockResolvedValue(SESSION)
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

  it('starts a stepped session and enables Step and Reset', async () => {
    render(<SimulationPanel />)

    expect(await screen.findByText(/No session yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Step' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Start Simulation' }))

    expect(await screen.findByText('Honeypots deployed.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()
    expect(startSession).toHaveBeenCalledWith({
      algorithm: 'A*',
      start_node: 'Internet',
      target_node: 'Database',
      honeypot_budget: 2,
    })
  })

  it('advances the attacker and reports interception, then disables Step', async () => {
    render(<SimulationPanel />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Simulation' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'Step' }))

    expect(await screen.findByText('Attacker intercepted by a honeypot')).toBeInTheDocument()
    expect(screen.getByText('Internet → Web Server')).toBeInTheDocument()
    expect(
      screen.getByText('Web Server is a honeypot. The attacker was deceived.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeDisabled())
    expect(stepSession).toHaveBeenCalledWith('session-1')
  })

  it('resets a session back to its first step', async () => {
    render(<SimulationPanel />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Simulation' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Step' }))
    await screen.findByText('Attacker intercepted by a honeypot')

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled())
    expect(resetSession).toHaveBeenCalledWith('session-1')
    expect(screen.queryByText('Attacker intercepted by a honeypot')).not.toBeInTheDocument()
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
