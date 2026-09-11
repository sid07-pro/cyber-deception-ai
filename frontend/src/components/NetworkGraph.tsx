/**
 * NetworkGraph.tsx
 * React Flow visualization of the simulated network.
 *
 * Read-only by design: nodes are positioned by their hop distance from the
 * attacker's entry point, and the attacker path / honeypots are highlighted
 * when a simulation result is supplied. No editing in this milestone.
 */

import { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'

import type { NetworkResponse } from '../api/types'

interface NetworkGraphProps {
  network: NetworkResponse
  path?: string[]
  honeypots?: string[]
}

const COLUMN_WIDTH = 200
const ROW_HEIGHT = 96

/** Lays nodes out in columns by hop distance from the attacker's entry point. */
function computePositions(network: NetworkResponse): Record<string, { x: number; y: number }> {
  const neighbours = new Map<string, string[]>()
  for (const node of network.nodes) {
    neighbours.set(node.id, [])
  }
  for (const edge of network.edges) {
    neighbours.get(edge.source)?.push(edge.target)
    neighbours.get(edge.target)?.push(edge.source)
  }

  const depth = new Map<string, number>([[network.attacker_start, 0]])
  const queue = [network.attacker_start]
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const neighbour of neighbours.get(current) ?? []) {
      if (!depth.has(neighbour)) {
        depth.set(neighbour, (depth.get(current) ?? 0) + 1)
        queue.push(neighbour)
      }
    }
  }

  const maxDepth = Math.max(0, ...depth.values())
  const columns = new Map<number, string[]>()
  for (const node of network.nodes) {
    const column = depth.get(node.id) ?? maxDepth + 1
    const bucket = columns.get(column) ?? []
    bucket.push(node.id)
    columns.set(column, bucket)
  }

  const positions: Record<string, { x: number; y: number }> = {}
  for (const [column, ids] of columns) {
    ids.forEach((id, index) => {
      positions[id] = {
        x: column * COLUMN_WIDTH,
        y: index * ROW_HEIGHT - ((ids.length - 1) * ROW_HEIGHT) / 2,
      }
    })
  }
  return positions
}

/** Border/background palette per node role, with highlights layered on top. */
function nodeStyle(
  criticality: string,
  isHoneypot: boolean,
  isOnPath: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 150,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'solid',
    padding: 8,
    fontSize: 12,
    color: '#e2e8f0',
    background: '#0f172a',
    borderColor: '#334155',
  }

  if (criticality === 'high') {
    base.background = '#450a0a'
    base.borderColor = '#b91c1c'
  } else if (criticality === 'medium') {
    base.background = '#1e293b'
    base.borderColor = '#475569'
  }

  if (isHoneypot) {
    base.background = '#422006'
    base.borderColor = '#f59e0b'
  }
  if (isOnPath) {
    base.boxShadow = '0 0 0 2px #34d399'
  }
  return base
}

export function NetworkGraph({ network, path = [], honeypots = [] }: NetworkGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const positions = computePositions(network)
    const pathSet = new Set(path)
    const honeypotSet = new Set(honeypots)

    // Consecutive pairs of the attacker path, order-insensitive for lookup.
    const pathEdges = new Set<string>()
    for (let i = 0; i < path.length - 1; i += 1) {
      pathEdges.add([path[i], path[i + 1]].sort().join('::'))
    }

    const flowNodes: Node[] = network.nodes.map((node) => {
      const isHoneypot = honeypotSet.has(node.id)
      const isOnPath = pathSet.has(node.id)
      return {
        id: node.id,
        position: positions[node.id] ?? { x: 0, y: 0 },
        data: {
          label: (
            <div className="text-left">
              <div className="font-semibold text-slate-100">{node.name}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">{node.type}</div>
              <div className="text-[10px] text-slate-400">criticality: {node.criticality}</div>
              {isHoneypot && <div className="text-[10px] text-amber-400">honeypot deployed</div>}
            </div>
          ),
        },
        style: nodeStyle(node.criticality, isHoneypot, isOnPath),
        draggable: false,
        connectable: false,
      }
    })

    const flowEdges: Edge[] = network.edges.map((edge) => {
      const onPath = pathEdges.has([edge.source, edge.target].sort().join('::'))
      return {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: String(edge.weight),
        animated: onPath,
        labelStyle: { fill: '#94a3b8', fontSize: 10 },
        labelBgStyle: { fill: '#0f172a' },
        style: { stroke: onPath ? '#34d399' : '#334155', strokeWidth: onPath ? 2.5 : 1.5 },
        markerEnd: onPath ? { type: MarkerType.ArrowClosed, color: '#34d399' } : undefined,
      }
    })

    return { nodes: flowNodes, edges: flowEdges }
  }, [network, path, honeypots])

  return (
    <div className="h-[420px] w-full rounded-lg border border-slate-700 bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
