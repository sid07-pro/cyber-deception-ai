/**
 * HoneypotPlacementPage.test.tsx
 * Covers the comparison of the greedy score with the two optimisers, the
 * client-side route coverage, and per-method error handling.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AIAnalyzeResponse, NetworkResponse, SimulationResponse } from '../api/types'
import type { SimulationSettings } from '../components/SimulationControls'
import { HoneypotPlacementPage } from './HoneypotPlacementPage'

const runSimulation = vi.fn()
const analyzeWithAI = vi.fn()

vi.mock('../api/client', () => ({
  runSimulation: (...args: unknown[]) => runSimulation(...args),
  analyzeWithAI: (...args: unknown[]) => analyzeWithAI(...args),
}))

vi.mock('../components/NetworkGraph', () => ({
  NetworkGraph: () => <div data-testid="network-graph" />,
  GraphLegend: () => null,
}))

const NETWORK: NetworkResponse = {
  nodes: [],
  edges: [],
  attacker_start: 'Internet',
  critical_target: 'Database',
  honeypot_candidates: [],
}

const SETTINGS: SimulationSettings = {
  algorithm: 'A*',
  startNode: 'Internet',
  targetNode: 'Database',
  honeypotCount: 2,
}

const GREEDY: SimulationResponse = {
  algorithm: 'A*',
  start_node: 'Internet',
  target_node: 'Database',
  path: ['Internet', 'Web Server', 'Application Server', 'Database'],
  path_cost: 8,
  nodes_explored: 7,
  honeypots: ['Web Server', 'Employee PC'],
  honeypot_scores: [
    { node: 'Web Server', attack_path_frequency: 4, target_proximity: 0.333, node_connectivity: 3, deployment_cost: 2, deception_score: 3.667, selected: true },
    { node: 'Employee PC', attack_path_frequency: 0, target_proximity: 0.333, node_connectivity: 3, deployment_cost: 1, deception_score: 3.333, selected: true },
    { node: 'Admin PC', attack_path_frequency: 0, target_proximity: 0.5, node_connectivity: 2, deployment_cost: 2, deception_score: 1.25, selected: false },
  ],
  result: 'intercepted',
  intercepted_at: 'Web Server',
  intercepted_at_step: 1,
  algorithm_comparison: [],
  alternative_paths: [
    { rank: 1, path: ['Internet', 'Web Server', 'Application Server', 'Database'], cost: 8, hops: 3, honeypots_on_path: ['Web Server'], intercepted: true },
    { rank: 2, path: ['Internet', 'Web Server', 'Employee PC', 'Admin PC', 'Database'], cost: 9, hops: 4, honeypots_on_path: ['Web Server', 'Employee PC'], intercepted: true },
  ],
  explanation: [],
}

function optimiser(technique: 'hill_climbing' | 'genetic_algorithm', honeypots: string[]): AIAnalyzeResponse {
  return {
    technique,
    start_node: 'Internet',
    target_node: 'Database',
    recommendation: honeypots.join(', '),
    score: 6.2667,
    probability: null,
    honeypots,
    metrics: { components: { coverage: 1, proximity: 0.4167, criticality: 0.6, deception: 1, cost: 4 } },
    explanation: [],
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HoneypotPlacementPage', () => {
  it('starts empty and asks the user to evaluate', () => {
    render(<HoneypotPlacementPage network={NETWORK} settings={SETTINGS} onSettingsChange={vi.fn()} />)
    expect(screen.getByText('No placement evaluated yet.')).toBeInTheDocument()
    expect(runSimulation).not.toHaveBeenCalled()
  })

  it('compares the greedy score with both optimisers on the same scenario', async () => {
    runSimulation.mockResolvedValue(GREEDY)
    analyzeWithAI.mockImplementation(({ technique }: { technique: 'hill_climbing' | 'genetic_algorithm' }) =>
      Promise.resolve(
        technique === 'hill_climbing'
          ? optimiser('hill_climbing', ['Application Server', 'Employee PC'])
          : optimiser('genetic_algorithm', ['Admin PC']),
      ),
    )
    render(<HoneypotPlacementPage network={NETWORK} settings={SETTINGS} onSettingsChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Evaluate placements' }))

    expect(await screen.findByText('Method comparison')).toBeInTheDocument()
    expect(analyzeWithAI).toHaveBeenCalledWith(
      expect.objectContaining({ technique: 'hill_climbing', honeypot_budget: 2, start_node: 'Internet' }),
    )
    expect(screen.getAllByText('Web Server, Employee PC').length).toBeGreaterThan(0)
    expect(screen.getByText('Application Server, Employee PC')).toBeInTheDocument()
    // Admin PC lies on only the second of the two cheapest routes.
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getAllByText('2 / 2')).toHaveLength(2)
  })

  it('reports a failing method without hiding the others', async () => {
    runSimulation.mockResolvedValue(GREEDY)
    analyzeWithAI.mockImplementation(({ technique }: { technique: string }) =>
      technique === 'genetic_algorithm'
        ? Promise.reject(new Error('Unknown technique'))
        : Promise.resolve(optimiser('hill_climbing', ['Web Server'])),
    )
    render(<HoneypotPlacementPage network={NETWORK} settings={SETTINGS} onSettingsChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Evaluate placements' }))

    await waitFor(() => expect(screen.getByText('Unknown technique')).toBeInTheDocument())
    expect(screen.getByText('Candidate locations')).toBeInTheDocument()
  })

  it('disables evaluation when start and target are the same node', () => {
    render(
      <HoneypotPlacementPage
        network={NETWORK}
        settings={{ ...SETTINGS, targetNode: 'Internet' }}
        onSettingsChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Evaluate placements' })).toBeDisabled()
  })
})
