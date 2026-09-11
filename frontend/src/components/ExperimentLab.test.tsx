/**
 * ExperimentLab.test.tsx
 * Covers the experiment controls, a successful run with its comparison chart,
 * the error state, and the CSV export helper.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExperimentResponse } from '../api/types'
import { experimentToCsv } from '../lib/export'
import { ExperimentLab } from './ExperimentLab'

const runExperiment = vi.fn()

vi.mock('../api/client', () => ({
  runExperiment: (...args: unknown[]) => runExperiment(...args),
}))

const METRICS = {
  total_runs: 4,
  successful_attacks: 1,
  intercepted_attacks: 3,
  deception_success_rate: 0.75,
  attack_success_rate: 0.25,
  average_path_cost: 8,
  average_nodes_explored: 7,
  average_steps: 1.5,
  average_execution_ms: 0.4,
  average_honeypot_count: 2,
  average_fitness: 6.18,
}

const EXPERIMENT: ExperimentResponse = {
  experiment_id: 'abcdef1234567890',
  configuration: { algorithm: 'A*', strategy: 'greedy', runs: 4 },
  metrics: METRICS,
  strategy_comparison: [
    { strategy: 'none', ...METRICS, deception_success_rate: 0, attack_success_rate: 1 },
    { strategy: 'greedy', ...METRICS },
  ],
  runs: [
    {
      run: 1,
      seed: 0,
      outcome: 'intercepted',
      path_cost: 8,
      nodes_explored: 7,
      steps: 1,
      honeypots: ['Web Server', 'Employee PC'],
      honeypot_count: 2,
      intercepted_at: 'Web Server',
      fitness: 6.18,
      execution_ms: 0.4,
    },
  ],
  truncated_runs: 0,
  explanation: ['4 run(s) of the A* attacker against the greedy strategy.'],
}

const PROPS = {
  nodeNames: ['Internet', 'Web Server', 'Database'],
  defaultStart: 'Internet',
  defaultTarget: 'Database',
}

beforeEach(() => {
  runExperiment.mockResolvedValue(EXPERIMENT)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ExperimentLab', () => {
  it('renders every control with sensible defaults', () => {
    render(<ExperimentLab {...PROPS} />)

    expect(screen.getByRole('combobox', { name: 'Experiment algorithm' })).toHaveValue('A*')
    expect(screen.getByRole('combobox', { name: 'Honeypot strategy' })).toHaveValue('greedy')
    expect(screen.getByRole('combobox', { name: 'Experiment budget' })).toHaveValue('2')
    expect(screen.getByRole('spinbutton', { name: 'Runs' })).toHaveValue(10)
    expect(screen.getByRole('spinbutton', { name: 'Experiment seed' })).toHaveValue(0)
    expect(screen.getByRole('combobox', { name: 'Experiment start node' })).toHaveValue('Internet')
    expect(screen.getByRole('combobox', { name: 'Experiment target node' })).toHaveValue('Database')
    expect(screen.getByText(/No experiment yet/i)).toBeInTheDocument()
  })

  it('runs an experiment and shows metrics, comparison, and run history', async () => {
    render(<ExperimentLab {...PROPS} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Runs' }), {
      target: { value: '4' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run Experiment' }))

    expect(await screen.findByText('Interception rate')).toBeInTheDocument()
    // 75% also appears in the greedy comparison bar; the tile is the <dd>.
    expect(screen.getByText('75%', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('25%', { selector: 'dd' })).toBeInTheDocument()
    // Strategy names also appear as <option>s; the comparison rows are <span>s.
    expect(screen.getByText('Greedy (deception score)', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('No deception', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Web Server, Employee PC')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument()

    expect(runExperiment).toHaveBeenCalledWith(
      expect.objectContaining({ algorithm: 'A*', strategy: 'greedy', runs: 4, seed: 0 }),
    )
  })

  it('clamps the run count to the backend limit', () => {
    render(<ExperimentLab {...PROPS} />)
    const runs = screen.getByRole('spinbutton', { name: 'Runs' })

    fireEvent.change(runs, { target: { value: '500' } })
    expect(runs).toHaveValue(100)

    fireEvent.change(runs, { target: { value: '0' } })
    expect(runs).toHaveValue(1)
  })

  it('shows an error state when the experiment fails', async () => {
    runExperiment.mockRejectedValue(new Error('runs must be between 1 and 100; got 500.'))
    render(<ExperimentLab {...PROPS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Run Experiment' }))

    await waitFor(() => expect(screen.getByText('Experiment failed')).toBeInTheDocument())
    expect(screen.getByText('runs must be between 1 and 100; got 500.')).toBeInTheDocument()
  })
})

describe('experimentToCsv', () => {
  it('emits a header, the overall row, and one row per compared strategy', () => {
    const lines = experimentToCsv(EXPERIMENT).split('\n')

    expect(lines).toHaveLength(4)
    expect(lines[0].startsWith('section,strategy,total_runs')).toBe(true)
    expect(lines[1].startsWith('overall,greedy,4')).toBe(true)
    expect(lines[2].startsWith('comparison,none,4')).toBe(true)
    expect(lines[3].startsWith('comparison,greedy,4')).toBe(true)
  })
})
