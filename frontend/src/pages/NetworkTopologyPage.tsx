/**
 * NetworkTopologyPage.tsx
 * Graph-analysis workspace: inspect hosts and links of the modelled network
 * and pick the analysis endpoints.
 *
 * All properties come from GET /api/network. Selecting a node (in the graph or
 * the host table) opens its properties; the start/target choice is the shared
 * analysis setting used by every analysis page.
 */

import { useMemo, useState } from 'react'
import type { NetworkResponse } from '../api/types'
import { GraphLegend, NetworkGraph } from '../components/NetworkGraph'
import type { SimulationSettings } from '../components/SimulationControls'

interface NetworkTopologyPageProps {
  network: NetworkResponse
  settings: SimulationSettings
  onSettingsChange: (settings: SimulationSettings) => void
  onAnalyse: () => void
}

export function NetworkTopologyPage({
  network,
  settings,
  onSettingsChange,
  onAnalyse,
}: NetworkTopologyPageProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const links = useMemo(() => {
    const map = new Map<string, { node: string; weight: number }[]>()
    for (const node of network.nodes) map.set(node.id, [])
    for (const edge of network.edges) {
      map.get(edge.source)?.push({ node: edge.target, weight: edge.weight })
      map.get(edge.target)?.push({ node: edge.source, weight: edge.weight })
    }
    return map
  }, [network])

  const node = network.nodes.find((item) => item.id === selected) ?? null
  const candidates = new Set(network.honeypot_candidates)

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="panel-title">Network topology</h2>
              <p className="panel-subtitle">
                {network.nodes.length} hosts · {network.edges.length} weighted links · undirected. Select a
                node to inspect it.
              </p>
            </div>
            <span className="eyebrow">Synthetic network</span>
          </div>
          <div className="p-3">
            <NetworkGraph
              network={network}
              selectedNode={selected}
              onSelectNode={setSelected}
              startNode={settings.startNode}
              targetNode={settings.targetNode}
              heightClass="h-[440px]"
            />
            <div className="mt-3 px-1">
              <GraphLegend />
            </div>
          </div>
        </section>

        <section className="panel overflow-x-auto">
          <h2 className="panel-title border-b border-line px-4 py-3">Hosts</h2>
          <table className="data-table min-w-[560px]">
            <thead>
              <tr>
                <th>Host</th>
                <th>Role</th>
                <th>Criticality</th>
                <th className="text-right">Degree</th>
                <th className="text-right">Deploy cost</th>
              </tr>
            </thead>
            <tbody>
              {network.nodes.map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer ${item.id === selected ? 'bg-raised text-fg' : 'text-fg-soft'}`}
                  onClick={() => setSelected(item.id)}
                >
                  <td>
                    <button
                      type="button"
                      className="text-left hover:text-gold-champagne"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelected(item.id)
                      }}
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className="font-mono text-xs text-fg-muted">{item.type}</td>
                  <td className="font-mono text-xs">{item.criticality}</td>
                  <td className="text-right font-mono tabular-nums">{links.get(item.id)?.length ?? 0}</td>
                  <td className="text-right font-mono tabular-nums">
                    {typeof item.metadata.deployment_cost === 'number' ? item.metadata.deployment_cost : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="space-y-5">
        <section className="panel p-4">
          <h2 className="panel-title">Analysis endpoints</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="kv-label">Start</dt>
              <dd className="text-fg">{settings.startNode || '—'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="kv-label">Target</dt>
              <dd className="text-fg">{settings.targetNode || '—'}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onAnalyse}
            disabled={!settings.startNode || !settings.targetNode || settings.startNode === settings.targetNode}
            className="btn-primary mt-4 w-full"
          >
            Analyse attack path
          </button>
        </section>

        <section className="panel p-4" aria-label="Asset properties">
          <h2 className="panel-title">Asset properties</h2>
          {node ? (
            <>
              <p className="mt-2 text-base font-semibold text-gold-champagne">{node.name}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <div>
                  <dt className="kv-label">Type</dt>
                  <dd className="kv-value font-mono text-xs">{node.type}</dd>
                </div>
                <div>
                  <dt className="kv-label">Criticality</dt>
                  <dd className={`kv-value ${node.criticality === 'high' ? 'text-bad' : ''}`}>{node.criticality}</dd>
                </div>
                <div>
                  <dt className="kv-label">Degree</dt>
                  <dd className="kv-value font-mono">{links.get(node.id)?.length ?? 0}</dd>
                </div>
                <div>
                  <dt className="kv-label">Deployment cost</dt>
                  <dd className="kv-value font-mono">
                    {typeof node.metadata.deployment_cost === 'number' ? node.metadata.deployment_cost : '—'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="kv-label">Honeypot eligible</dt>
                  <dd className="kv-value">{candidates.has(node.id) ? 'Yes — candidate' : 'No'}</dd>
                </div>
              </dl>

              <h3 className="eyebrow mt-4">Links</h3>
              <ul className="mt-1.5 divide-y divide-line-soft text-sm">
                {(links.get(node.id) ?? []).map((link) => (
                  <li key={link.node} className="flex items-center justify-between py-1.5">
                    <button
                      type="button"
                      className="text-fg-soft hover:text-gold-champagne"
                      onClick={() => setSelected(link.node)}
                    >
                      {link.node}
                    </button>
                    <span className="font-mono text-xs text-fg-faint">cost {link.weight}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={node.id === settings.startNode}
                  onClick={() => onSettingsChange({ ...settings, startNode: node.id })}
                >
                  Set as start
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={node.id === settings.targetNode}
                  onClick={() => onSettingsChange({ ...settings, targetNode: node.id })}
                >
                  Set as target
                </button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-fg-faint">
              Select a host in the graph or the table to see its properties and links.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
