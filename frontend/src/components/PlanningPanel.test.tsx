/**
 * PlanningPanel.test.tsx
 * Covers plan generation, the no-plan case, and the error state.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanResponse } from '../api/types'
import { PlanningPanel } from './PlanningPanel'
import type { SimulationSettings } from './SimulationControls'

const createPlan = vi.fn()

vi.mock('../api/client', () => ({
  createPlan: (...args: unknown[]) => createPlan(...args),
}))

const SETTINGS: SimulationSettings = {
  algorithm: 'A*',
  startNode: 'Internet',
  targetNode: 'Database',
  honeypotCount: 2,
}

const PLAN: PlanResponse = {
  method: 'forward',
  goal_type: 'protect_target',
  goal: 'fortify or sever every route into Database',
  start_node: 'Internet',
  target_node: 'Database',
  honeypot_budget: 2,
  max_depth: 4,
  success: true,
  actions: [
    {
      name: 'place_honeypot',
      parameters: ['Application Server'],
      cost: 2,
      description: 'place_honeypot(Application Server)',
    },
    {
      name: 'block_route',
      parameters: ['Admin PC', 'Database'],
      cost: 3,
      description: 'block_route(Admin PC, Database)',
    },
  ],
  plan_length: 2,
  plan_cost: 5,
  explored_states: 48,
  final_state: ['at(Internet)'],
  reason: '',
  explanation: ['Forward state-space search was used.'],
}

beforeEach(() => {
  createPlan.mockResolvedValue(PLAN)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PlanningPanel', () => {
  it('generates a plan and lists its actions in order', async () => {
    render(<PlanningPanel settings={SETTINGS} />)

    expect(screen.getByRole('combobox', { name: 'Planning method' })).toHaveValue('forward')
    expect(screen.getByRole('combobox', { name: 'Goal' })).toHaveValue('protect_target')
    expect(screen.getByText(/No plan yet/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Generate Plan' }))

    expect(await screen.findByText('Plan found — 2 action(s), cost 5')).toBeInTheDocument()
    expect(screen.getByText('place_honeypot(Application Server)')).toBeInTheDocument()
    expect(screen.getByText('block_route(Admin PC, Database)')).toBeInTheDocument()
    expect(screen.getByText(/48 state\(s\) explored/)).toBeInTheDocument()

    expect(createPlan).toHaveBeenCalledWith({
      method: 'forward',
      goal_type: 'protect_target',
      start_node: 'Internet',
      target_node: 'Database',
      honeypot_budget: 2,
      max_depth: 4,
    })
  })

  it('sends the backward method when it is selected', async () => {
    render(<PlanningPanel settings={SETTINGS} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Planning method' }), {
      target: { value: 'backward' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate Plan' }))

    await waitFor(() =>
      expect(createPlan).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'backward' }),
      ),
    )
  })

  it('reports the no-plan case without treating it as an error', async () => {
    createPlan.mockResolvedValue({
      ...PLAN,
      success: false,
      actions: [],
      plan_length: 0,
      plan_cost: 0,
      reason: 'no plan within depth 1',
    })
    render(<PlanningPanel settings={SETTINGS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Generate Plan' }))

    expect(await screen.findByText('No plan found — no plan within depth 1')).toBeInTheDocument()
    expect(screen.queryByText('Planning failed')).not.toBeInTheDocument()
  })

  it('shows an error state when the request fails', async () => {
    createPlan.mockRejectedValue(new Error("Unknown node 'Mainframe'."))
    render(<PlanningPanel settings={SETTINGS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Generate Plan' }))

    await waitFor(() => expect(screen.getByText('Planning failed')).toBeInTheDocument())
    expect(screen.getByText("Unknown node 'Mainframe'.")).toBeInTheDocument()
  })
})
