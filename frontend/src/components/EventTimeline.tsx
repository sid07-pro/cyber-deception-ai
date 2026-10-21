/**
 * EventTimeline.tsx
 * Ordered log of what each agent did at each time step.
 */

import type { SimulationEvent } from '../api/types'

const KIND_STYLES: Record<string, string> = {
  plan: 'text-gold-champagne',
  deploy: 'text-warn',
  move: 'text-fg-soft',
  compromise: 'text-bad',
  intercepted: 'text-ok',
  target_reached: 'text-bad',
  failed: 'text-fg-muted',
  invalid: 'text-fg-muted',
}

export function EventTimeline({ events }: { events: SimulationEvent[] }) {
  return (
    <section className="panel p-4">
      <h2 className="panel-title">Event timeline</h2>

      {events.length === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">
          No events yet — start a simulation to see the agents act.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {events.map((event, index) => (
            <li
              key={`${event.step}-${index}-${event.kind}`}
              className="flex gap-3 rounded border border-line-soft bg-well px-3 py-2 text-sm"
            >
              <span className="tabular-nums text-fg-faint">t{event.step}</span>
              <span className={`w-24 shrink-0 text-xs uppercase ${KIND_STYLES[event.kind] ?? 'text-fg-muted'}`}>
                {event.kind}
              </span>
              <span className="text-fg-soft">{event.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
