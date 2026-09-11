/**
 * HealthStatus.tsx
 * Calls the backend health endpoint on mount and reports the connection state.
 */

import { useEffect, useState } from 'react'
import { getHealth, type HealthResponse } from '../api/client'

type ConnectionState =
  | { kind: 'loading' }
  | { kind: 'connected'; health: HealthResponse }
  | { kind: 'error'; message: string }

export function HealthStatus() {
  const [state, setState] = useState<ConnectionState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    getHealth(controller.signal)
      .then((health) => setState({ kind: 'connected', health }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const message = error instanceof Error ? error.message : 'Unknown error'
        setState({ kind: 'error', message })
      })

    return () => controller.abort()
  }, [])

  if (state.kind === 'loading') {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <p className="text-slate-400">Connecting to backend…</p>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-lg border border-red-800 bg-slate-900 p-4">
        <p className="font-semibold text-red-400">Backend unreachable</p>
        <p className="mt-1 text-sm text-slate-400">{state.message}</p>
      </div>
    )
  }

  const { status, service, version } = state.health

  return (
    <div className="rounded-lg border border-emerald-800 bg-slate-900 p-4">
      <p className="font-semibold text-emerald-400">Backend connected</p>
      <dl className="mt-2 space-y-1 text-sm text-slate-300">
        <div className="flex gap-2">
          <dt className="text-slate-500">status</dt>
          <dd>{status}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">service</dt>
          <dd>{service}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">version</dt>
          <dd>{version}</dd>
        </div>
      </dl>
    </div>
  )
}
