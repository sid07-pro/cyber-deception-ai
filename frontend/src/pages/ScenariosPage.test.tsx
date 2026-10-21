/**
 * ScenariosPage.test.tsx
 * Covers saving a scenario, simulating one, the empty states, and the
 * database-error state.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScenarioSummary, SimulationResponse, StoredExperimentSummary } from '../api/types'
import { ScenariosPage } from './ScenariosPage'

const saveCurrentNetwork = vi.fn()
const listScenarios = vi.fn()
const deleteScenario = vi.fn()
const listStoredExperiments = vi.fn()
const runSimulation = vi.fn()

vi.mock('../api/client', () => ({
  saveCurrentNetwork: (...args: unknown[]) => saveCurrentNetwork(...args),
  listScenarios: (...args: unknown[]) => listScenarios(...args),
  deleteScenario: (...args: unknown[]) => deleteScenario(...args),
  listStoredExperiments: (...args: unknown[]) => listStoredExperiments(...args),
  runSimulation: (...args: unknown[]) => runSimulation(...args),
}))

const SCENARIO: ScenarioSummary = {
  id: 1,
  name: 'baseline-network',
  description: 'the built-in topology',
  attacker_start: 'Internet',
  critical_target: 'Database',
  created_at: '2026-09-12T10:00:00Z',
  node_count: 7,
  edge_count: 9,
  experiment_count: 2,
}

const EXPERIMENT: StoredExperimentSummary = {
  experiment_id: 'abc123',
  scenario_id: 1,
  created_at: '2026-09-12T10:05:00Z',
  algorithm: 'A*',
  strategy: 'greedy',
  honeypot_budget: 2,
  runs: 10,
  seed: 0,
  deception_success_rate: 0.8,
  attack_success_rate: 0.2,
}

const RESULT: SimulationResponse = {
  algorithm: 'UCS',
  start_node: 'Internet',
  target_node: 'Database',
  path: ['Internet', 'Web Server', 'Application Server', 'Database'],
  path_cost: 8,
  nodes_explored: 6,
  honeypots: ['Web Server'],
  honeypot_scores: [],
  result: 'intercepted',
  intercepted_at: 'Web Server',
  intercepted_at_step: 1,
  algorithm_comparison: [],
  alternative_paths: [
    {
      rank: 1,
      path: ['Internet', 'Web Server', 'Application Server', 'Database'],
      cost: 8,
      hops: 3,
      honeypots_on_path: ['Web Server'],
      intercepted: true,
    },
    {
      rank: 2,
      path: ['Internet', 'Web Server', 'Employee PC', 'Admin PC', 'Database'],
      cost: 9,
      hops: 4,
      honeypots_on_path: [],
      intercepted: false,
    },
  ],
  scenario_id: 1,
  explanation: ['The attacker agent used Uniform Cost Search.'],
}

beforeEach(() => {
  listScenarios.mockResolvedValue([])
  listStoredExperiments.mockResolvedValue([])
  saveCurrentNetwork.mockResolvedValue({ id: 1 })
  deleteScenario.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ScenariosPage', () => {
  it('shows empty states when nothing is saved yet', async () => {
    render(<ScenariosPage />)

    expect(await screen.findByText(/Nothing saved yet/i)).toBeInTheDocument()
    expect(screen.getByText(/No saved experiments yet/i)).toBeInTheDocument()
  })

  it('lists saved scenarios and experiment history', async () => {
    listScenarios.mockResolvedValue([SCENARIO])
    listStoredExperiments.mockResolvedValue([EXPERIMENT])
    render(<ScenariosPage />)

    expect(await screen.findByText('baseline-network')).toBeInTheDocument()
    expect(screen.getByText(/7 nodes · 9 edges · 2 experiment/)).toBeInTheDocument()
    expect(screen.getByText('Greedy (deception score)')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('saves the current network and refreshes the list', async () => {
    render(<ScenariosPage />)
    await screen.findByText(/Nothing saved yet/i)

    fireEvent.change(screen.getByRole('textbox', { name: 'Scenario name' }), {
      target: { value: 'my-net' },
    })
    listScenarios.mockResolvedValue([{ ...SCENARIO, name: 'my-net' }])
    fireEvent.click(screen.getByRole('button', { name: 'Save Scenario' }))

    await waitFor(() =>
      expect(saveCurrentNetwork).toHaveBeenCalledWith({ name: 'my-net', description: '' }),
    )
    expect(await screen.findByText('my-net')).toBeInTheDocument()
  })

  it('refuses to save without a name', async () => {
    render(<ScenariosPage />)
    await screen.findByText(/Nothing saved yet/i)

    fireEvent.click(screen.getByRole('button', { name: 'Save Scenario' }))

    expect(screen.getByText('Give the scenario a name before saving.')).toBeInTheDocument()
    expect(saveCurrentNetwork).not.toHaveBeenCalled()
  })

  it('deletes a scenario', async () => {
    listScenarios.mockResolvedValue([SCENARIO])
    render(<ScenariosPage />)
    await screen.findByText('baseline-network')

    listScenarios.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Delete baseline-network' }))

    await waitFor(() => expect(deleteScenario).toHaveBeenCalledWith(1))
    expect(await screen.findByText(/Nothing saved yet/i)).toBeInTheDocument()
  })

  it('reports an unreachable database instead of breaking', async () => {
    listScenarios.mockRejectedValue(new Error('The database is unavailable.'))
    listStoredExperiments.mockRejectedValue(new Error('The database is unavailable.'))
    render(<ScenariosPage />)

    expect(await screen.findByText('Could not load scenarios')).toBeInTheDocument()
    expect(screen.getByText('Could not load history')).toBeInTheDocument()
  })

  it('simulates a saved scenario with the chosen algorithm and shows its routes', async () => {
    listScenarios.mockResolvedValue([SCENARIO])
    runSimulation.mockResolvedValue(RESULT)
    render(<ScenariosPage />)
    await screen.findByText('baseline-network')

    fireEvent.change(screen.getByRole('combobox', { name: 'Scenario simulation algorithm' }), {
      target: { value: 'UCS' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simulate baseline-network' }))

    await waitFor(() =>
      expect(runSimulation).toHaveBeenCalledWith({ algorithm: 'UCS', scenario_id: 1 }),
    )
    expect(await screen.findByText('Attacker intercepted by a honeypot')).toBeInTheDocument()
    expect(screen.getByText('Cheapest alternative routes')).toBeInTheDocument()
    expect(screen.getByText('Uncovered')).toBeInTheDocument()
  })

  it('shows a simulation failure for a saved scenario', async () => {
    listScenarios.mockResolvedValue([SCENARIO])
    runSimulation.mockRejectedValue(new Error('No scenario with id 1.'))
    render(<ScenariosPage />)
    await screen.findByText('baseline-network')

    fireEvent.click(screen.getByRole('button', { name: 'Simulate baseline-network' }))

    expect(await screen.findByText(/Could not simulate/)).toBeInTheDocument()
    expect(screen.getByText('No scenario with id 1.')).toBeInTheDocument()
  })
})
