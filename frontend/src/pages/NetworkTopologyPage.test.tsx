/**
 * NetworkTopologyPage.test.tsx
 * Covers the asset inspector (opened from the host table) and choosing the
 * analysis endpoints from it.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { NetworkResponse } from '../api/types'
import type { SimulationSettings } from '../components/SimulationControls'
import { NetworkTopologyPage } from './NetworkTopologyPage'

vi.mock('../components/NetworkGraph', () => ({
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
      metadata: { deployment_cost: 2 },
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

const SETTINGS: SimulationSettings = {
  algorithm: 'A*',
  startNode: 'Internet',
  targetNode: 'Database',
  honeypotCount: 2,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NetworkTopologyPage', () => {
  it('prompts for a selection until a host is chosen', () => {
    render(<NetworkTopologyPage network={NETWORK} settings={SETTINGS} onSettingsChange={vi.fn()} onAnalyse={vi.fn()} />)
    expect(screen.getByText(/Select a host in the graph or the table/)).toBeInTheDocument()
  })

  it('shows the selected host’s real properties and links', () => {
    render(<NetworkTopologyPage network={NETWORK} settings={SETTINGS} onSettingsChange={vi.fn()} onAnalyse={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Web Server' }))

    const inspector = within(screen.getByRole('region', { name: 'Asset properties' }))
    expect(inspector.getByText('Yes — candidate')).toBeInTheDocument()
    expect(inspector.getByText('cost 1')).toBeInTheDocument()
    expect(inspector.getByText('cost 5')).toBeInTheDocument()
  })

  it('sets the analysis start from the inspector and launches the analysis', () => {
    const onSettingsChange = vi.fn()
    const onAnalyse = vi.fn()
    render(
      <NetworkTopologyPage network={NETWORK} settings={SETTINGS} onSettingsChange={onSettingsChange} onAnalyse={onAnalyse} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Web Server' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set as start' }))
    expect(onSettingsChange).toHaveBeenCalledWith({ ...SETTINGS, startNode: 'Web Server' })

    fireEvent.click(screen.getByRole('button', { name: 'Analyse attack path' }))
    expect(onAnalyse).toHaveBeenCalled()
  })
})
