/**
 * EventTimeline.tsx
 * Ordered log of what each agent did at each time step.
 */

import type { SimulationEvent } from '../api/types'

const KIND_STYLES: Record<string, string> = {
  plan: 'text-sky-400',
  deploy: 'text-amber-400',
  move: 'text-slate-300',
  compromise: 'text-red-400',
  intercepted: 'text-emerald-400',
  target_reached: 'text-red-400',
  failed: 'text-slate-400',
  invalid: 'text-slate-400',
}

export function EventTimeline({ events }: { events: SimulationEvent[] }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Event timeline</h2>

      {events.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">
          No events yet — start a simulation to see the agents act.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {events.map((event, index) => (
            <li
              key={`${event.step}-${index}-${event.kind}`}
              className="flex gap-3 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            >
              <span className="tabular-nums text-slate-600">t{event.step}</span>
              <span className={`w-24 shrink-0 text-xs uppercase ${KIND_STYLES[event.kind] ?? 'text-slate-400'}`}>
                {event.kind}
              </span>
              <span className="text-slate-300">{event.message}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
