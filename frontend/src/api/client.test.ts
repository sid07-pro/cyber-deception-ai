/**
 * client.test.ts
 * Verifies the API client builds the right requests and surfaces backend errors.
 * Pure fetch-level tests — no DOM environment required.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getNetwork,
  isApiBaseUrlMissing,
  MISSING_API_URL_MESSAGE,
  runSimulation,
} from './client'

function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getNetwork', () => {
  it('requests /api/network and returns the parsed topology', async () => {
    const network = {
      nodes: [],
      edges: [],
      attacker_start: 'Internet',
      critical_target: 'Database',
      honeypot_candidates: [],
    }
    const fetchMock = mockFetch({ ok: true, status: 200, body: network })

    await expect(getNetwork()).resolves.toEqual(network)
    expect(fetchMock).toHaveBeenCalledWith('/api/network', { signal: undefined })
  })
})

describe('runSimulation', () => {
  it('POSTs the request body as JSON to /api/simulate', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: { algorithm: 'BFS' } })

    await runSimulation({ algorithm: 'BFS', start_node: 'Internet', target_node: 'Database' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/simulate')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      algorithm: 'BFS',
      start_node: 'Internet',
      target_node: 'Database',
    })
  })

  it('surfaces the backend detail message on an error response', async () => {
    mockFetch({ ok: false, status: 404, body: { detail: "Unknown node 'Mainframe'." } })

    await expect(runSimulation({ algorithm: 'BFS' })).rejects.toThrow("Unknown node 'Mainframe'.")
  })
})

describe('production configuration', () => {
  it('exposes a clear message naming the variable to set', () => {
    expect(MISSING_API_URL_MESSAGE).toContain('VITE_API_BASE_URL')
  })

  it('is satisfied in development, where the dev proxy handles /api', () => {
    // import.meta.env.PROD is false under vitest, matching `npm run dev`.
    expect(isApiBaseUrlMissing()).toBe(false)
  })

  it('sends requests to a relative /api path when no base URL is set', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: {} })

    await getNetwork()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/network')
  })
})
