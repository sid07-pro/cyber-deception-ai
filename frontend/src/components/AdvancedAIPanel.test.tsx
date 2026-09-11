/**
 * AdvancedAIPanel.test.tsx
 * Covers technique selection, a successful analysis, and the error state.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AIAnalyzeResponse } from '../api/types'
import { AdvancedAIPanel } from './AdvancedAIPanel'
import type { SimulationSettings } from './SimulationControls'

const analyzeWithAI = vi.fn()

vi.mock('../api/client', () => ({
  analyzeWithAI: (...args: unknown[]) => analyzeWithAI(...args),
}))

const SETTINGS: SimulationSettings = {
  algorithm: 'A*',
  startNode: 'Internet',
  targetNode: 'Database',
  honeypotCount: 2,
}

const MINIMAX_RESULT: AIAnalyzeResponse = {
  technique: 'minimax',
  start_node: 'Internet',
  target_node: 'Database',
  recommendation: 'move Web Server',
  score: 4.25,
  probability: null,
  honeypots: [],
  metrics: { depth: 4, nodes_visited: 120, branches_pruned: 0 },
  explanation: ['Minimax searched 4 plies of the attacker-versus-defender game.'],
}

const GENETIC_RESULT: AIAnalyzeResponse = {
  ...MINIMAX_RESULT,
  technique: 'genetic_algorithm',
  recommendation: 'Web Server, Employee PC',
  score: 6.1,
  honeypots: ['Web Server', 'Employee PC'],
  explanation: ['The genetic algorithm selected Web Server, Employee PC.'],
}

beforeEach(() => {
  analyzeWithAI.mockResolvedValue(MINIMAX_RESULT)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdvancedAIPanel', () => {
  it('offers every technique and shows depth only for game search', () => {
    render(<AdvancedAIPanel settings={SETTINGS} />)

    const technique = screen.getByRole('combobox', { name: 'Technique' })
    expect(technique).toHaveValue('minimax')
    expect(screen.getByRole('option', { name: 'Alpha-Beta' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bayesian Risk' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Hill Climbing' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Genetic Algorithm' })).toBeInTheDocument()

    // Minimax needs a depth; only the optimizers expose a seed.
    expect(screen.getByRole('combobox', { name: 'Search depth' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'Random seed' })).not.toBeInTheDocument()
    expect(screen.getByText(/No analysis yet/i)).toBeInTheDocument()

    fireEvent.change(technique, { target: { value: 'genetic_algorithm' } })
    expect(screen.queryByRole('combobox', { name: 'Search depth' })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Random seed' })).toBeInTheDocument()
  })

  it('runs the selected technique and shows the recommendation', async () => {
    render(<AdvancedAIPanel settings={SETTINGS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }))

    expect(await screen.findByText('move Web Server')).toBeInTheDocument()
    expect(screen.getByText('4.25')).toBeInTheDocument()
    expect(
      screen.getByText('Minimax searched 4 plies of the attacker-versus-defender game.'),
    ).toBeInTheDocument()
    expect(analyzeWithAI).toHaveBeenCalledWith({
      technique: 'minimax',
      start_node: 'Internet',
      target_node: 'Database',
      honeypot_budget: 2,
      depth: 4,
      seed: 0,
      algorithm: 'A*',
    })
  })

  it('shows recommended honeypots for the placement optimizers', async () => {
    analyzeWithAI.mockResolvedValue(GENETIC_RESULT)
    render(<AdvancedAIPanel settings={SETTINGS} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Technique' }), {
      target: { value: 'genetic_algorithm' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }))

    // Shown twice: once as the recommendation, once as the honeypot list.
    expect(await screen.findAllByText('Web Server, Employee PC')).toHaveLength(2)
    expect(screen.getByText('Recommended honeypots')).toBeInTheDocument()
    expect(analyzeWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ technique: 'genetic_algorithm', seed: 0 }),
    )
  })

  it('shows an error state when the analysis fails', async () => {
    analyzeWithAI.mockRejectedValue(new Error("Unknown node 'Mainframe'."))
    render(<AdvancedAIPanel settings={SETTINGS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }))

    await waitFor(() => expect(screen.getByText('Analysis failed')).toBeInTheDocument())
    expect(screen.getByText("Unknown node 'Mainframe'.")).toBeInTheDocument()
  })
})
