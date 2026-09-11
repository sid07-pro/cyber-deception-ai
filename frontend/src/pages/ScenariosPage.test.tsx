/**
 * ScenariosPage.test.tsx
 * Covers saving a scenario, the empty states, and the database-error state.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScenarioSummary, StoredExperimentSummary } from '../api/types'
import { ScenariosPage } from './ScenariosPage'

const saveCurrentNetwork = vi.fn()
const listScenarios = vi.fn()
const deleteScenario = vi.fn()
const listStoredExperiments = vi.fn()

vi.mock('../api/client', () => ({
  saveCurrentNetwork: (...args: unknown[]) => saveCurrentNetwork(...args),
  listScenarios: (...args: unknown[]) => listScenarios(...args),
  deleteScenario: (...args: unknown[]) => deleteScenario(...args),
  listStoredExperiments: (...args: unknown[]) => listStoredExperiments(...args),
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
})
