/**
 * HealthStatus.tsx
 * Backend connectivity, from the real /api/health endpoint.
 *
 * `useBackendHealth` polls the endpoint (on mount, then every 30 s) so the
 * shell header and the dashboard share one source of truth; nothing here is
 * simulated or inferred.
 */

import { useCallback, useEffect, useState } from 'react'
import { getHealth, type HealthResponse } from '../api/client'

export type ConnectionState =
  | { kind: 'loading' }
  | { kind: 'connected'; health: HealthResponse; checkedAt: Date }
  | { kind: 'error'; message: string; checkedAt: Date }

const POLL_MS = 30_000

export function useBackendHealth(): { state: ConnectionState; refresh: () => void } {
  const [state, setState] = useState<ConnectionState>({ kind: 'loading' })
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((health) => setState({ kind: 'connected', health, checkedAt: new Date() }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const message = error instanceof Error ? error.message : 'Unknown error'
        setState({ kind: 'error', message, checkedAt: new Date() })
      })
    return () => controller.abort()
  }, [tick])

  useEffect(() => {
    const id = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  return { state, refresh }
}

/** Compact header indicator. */
export function BackendStatusPill({ state, onRetry }: { state: ConnectionState; onRetry: () => void }) {
  if (state.kind === 'loading') {
    return (
      <span className="badge border-line text-fg-faint" role="status">
        <span className="h-1.5 w-1.5 rounded-full bg-fg-faint" aria-hidden />
        Checking API
      </span>
    )
  }

  if (state.kind === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={state.message}
        className="badge border-bad/40 text-bad transition-colors hover:border-bad/70"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-bad" aria-hidden />
        API unreachable · retry
      </button>
    )
  }

  const database = state.health.database
  return (
    <span
      className="badge border-line text-fg-muted"
      role="status"
      title={`Checked ${state.checkedAt.toLocaleTimeString()}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
      API v{state.health.version}
      {database && (
        <span className={database === 'connected' ? 'text-fg-faint' : 'text-warn'}>
          · DB {database}
        </span>
      )}
    </span>
  )
}
