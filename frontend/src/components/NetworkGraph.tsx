/**
 * NetworkGraph.tsx
 * React Flow visualization of the simulated network.
 *
 * Nodes are laid out in columns by hop distance from the attacker's entry
 * point (the protected asset always gets the last column), and each column is
 * ordered by the mean position of its upstream neighbours to reduce crossings.
 * Edges run centre to centre as straight links labelled with their weight.
 *
 * Roles are distinguished by glyph and text tag as well as colour, so the
 * graph stays readable without relying on colour alone.
 */

import { memo, useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'

import type { NetworkNode, NetworkResponse } from '../api/types'

interface NetworkGraphProps {
  network: NetworkResponse
  path?: string[]
  honeypots?: string[]
  visitedNodes?: string[]
  attackerPosition?: string | null
  /** Highlights one node and makes nodes clickable. */
  selectedNode?: string | null
  onSelectNode?: (nodeId: string | null) => void
  /** Overrides the scenario's entry point / target for the role tags. */
  startNode?: string
  targetNode?: string
  heightClass?: string
}

const COLUMN_WIDTH = 178
const ROW_HEIGHT = 140

const COLORS = {
  surface: '#151515',
  surfaceHi: '#1B1A18',
  border: '#302D27',
  borderStrong: '#47423A',
  text: '#E8E5DE',
  muted: '#9A978F',
  faint: '#827F77',
  gold: '#C9A45C',
  champagne: '#E5D2A0',
  warn: '#D29A4E',
  bad: '#D27C72',
  edge: '#3A3630',
}

type Role = 'entry' | 'target' | 'critical' | 'candidate' | 'host'

interface GraphNodeData {
  node: NetworkNode
  role: Role
  isHoneypot: boolean
  isOnPath: boolean
  isVisited: boolean
  isAttacker: boolean
  isSelected: boolean
  clickable: boolean
}

/** Lays nodes out in columns by hop distance from the attacker's entry point. */
function computePositions(
  network: NetworkResponse,
  start: string,
  target: string,
): Record<string, { x: number; y: number }> {
  const neighbours = new Map<string, string[]>()
  for (const node of network.nodes) neighbours.set(node.id, [])
  for (const edge of network.edges) {
    neighbours.get(edge.source)?.push(edge.target)
    neighbours.get(edge.target)?.push(edge.source)
  }

  const depth = new Map<string, number>([[start, 0]])
  const queue = [start]
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
  const columnOf = (id: string) => {
    if (id === target && depth.has(id) && id !== start) return maxDepth + 1
    return depth.get(id) ?? maxDepth + 2
  }

  const columns = new Map<number, string[]>()
  for (const node of network.nodes) {
    const column = columnOf(node.id)
    columns.set(column, [...(columns.get(column) ?? []), node.id])
  }

  const positions: Record<string, { x: number; y: number }> = {}
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const ids = columns.get(column) ?? []
    // Barycentre ordering: sit each node near the neighbours already placed.
    const order = ids
      .map((id, index) => {
        const placed = (neighbours.get(id) ?? []).filter((n) => positions[n] !== undefined)
        const mean =
          placed.length > 0
            ? placed.reduce((sum, n) => sum + positions[n].y, 0) / placed.length
            : 0
        return { id, mean, index }
      })
      .sort((a, b) => a.mean - b.mean || a.index - b.index)

    order.forEach(({ id }, index) => {
      positions[id] = {
        x: column * COLUMN_WIDTH,
        y: index * ROW_HEIGHT - ((order.length - 1) * ROW_HEIGHT) / 2,
      }
    })
  }
  return positions
}

function roleOf(node: NetworkNode, start: string, target: string): Role {
  if (node.id === start) return 'entry'
  if (node.id === target) return 'target'
  if (node.criticality === 'high') return 'critical'
  if (node.type === 'honeypot_candidate') return 'candidate'
  return 'host'
}

const ROLE_TAGS: Record<Role, string> = {
  entry: 'Entry',
  target: 'Target',
  critical: 'Critical',
  candidate: 'Candidate',
  host: 'Host',
}

/** Small role glyph: shape differs per role, not just colour. */
export function RoleGlyph({ role, decoy = false, size = 12 }: { role: Role; decoy?: boolean; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 12 12', 'aria-hidden': true as const }
  if (decoy) {
    return (
      <svg {...common}>
        <polygon points="6,0.8 10.8,3.4 10.8,8.6 6,11.2 1.2,8.6 1.2,3.4" fill={COLORS.warn} />
      </svg>
    )
  }
  switch (role) {
    case 'entry':
      return (
        <svg {...common}>
          <polygon points="1.5,1 10.5,6 1.5,11" fill="none" stroke={COLORS.champagne} strokeWidth="1.4" />
        </svg>
      )
    case 'target':
    case 'critical':
      return (
        <svg {...common}>
          <polygon points="6,0.8 11.2,6 6,11.2 0.8,6" fill={COLORS.bad} />
        </svg>
      )
    case 'candidate':
      return (
        <svg {...common}>
          <polygon
            points="6,0.8 10.8,3.4 10.8,8.6 6,11.2 1.2,8.6 1.2,3.4"
            fill="none"
            stroke={COLORS.muted}
            strokeWidth="1.2"
          />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke={COLORS.muted} strokeWidth="1.2" />
        </svg>
      )
  }
}

const HIDDEN_HANDLE: React.CSSProperties = {
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  pointerEvents: 'none',
}

const HostNode = memo(function HostNode({ data }: NodeProps<GraphNodeData>) {
  const { node, role, isHoneypot, isOnPath, isVisited, isAttacker, isSelected, clickable } = data

  let border = COLORS.border
  if (role === 'target' || role === 'critical') border = 'rgba(210,124,114,0.55)'
  if (isHoneypot) border = 'rgba(210,154,78,0.7)'
  if (isOnPath) border = COLORS.gold
  if (isAttacker) border = COLORS.bad

  const ring = isSelected
    ? `0 0 0 1px ${COLORS.champagne}, 0 0 0 4px rgba(201,164,92,0.18)`
    : isAttacker
      ? '0 0 0 3px rgba(210,124,114,0.25)'
      : 'none'

  const tag = isHoneypot ? 'Decoy' : ROLE_TAGS[role]

  return (
    <div
      style={{
        width: 140,
        padding: '7px 9px',
        borderRadius: 6,
        border: `1px solid ${border}`,
        background: isSelected ? COLORS.surfaceHi : COLORS.surface,
        boxShadow: ring,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'border-color 150ms, box-shadow 150ms, background 150ms',
      }}
    >
      <Handle type="target" position={Position.Top} style={HIDDEN_HANDLE} isConnectable={false} />
      <Handle type="source" position={Position.Top} style={HIDDEN_HANDLE} isConnectable={false} />

      <div className="flex min-w-0 items-center gap-1.5" title={`${node.name} · criticality ${node.criticality}`}>
        <RoleGlyph role={role} decoy={isHoneypot} />
        <span className="truncate text-xs font-semibold text-fg">{node.name}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em]">
        <span style={{ color: isHoneypot ? COLORS.warn : role === 'target' ? COLORS.bad : COLORS.faint }}>
          {tag}
        </span>
        {isAttacker ? (
          <span style={{ color: COLORS.bad }}>attacker</span>
        ) : isVisited ? (
          <span style={{ color: COLORS.champagne }}>visited</span>
        ) : isOnPath ? (
          <span style={{ color: COLORS.gold }}>on route</span>
        ) : null}
      </div>
    </div>
  )
})

const NODE_TYPES = { host: HostNode }

export function NetworkGraph({
  network,
  path = [],
  honeypots = [],
  visitedNodes = [],
  attackerPosition = null,
  selectedNode = null,
  onSelectNode,
  startNode,
  targetNode,
  heightClass = 'h-[440px]',
}: NetworkGraphProps) {
  const start = startNode || network.attacker_start
  const target = targetNode || network.critical_target

  const { nodes, edges } = useMemo(() => {
    const positions = computePositions(network, network.attacker_start, network.critical_target)
    const pathSet = new Set(path)
    const honeypotSet = new Set(honeypots)
    const visitedSet = new Set(visitedNodes)

    // Consecutive pairs of the attacker path, order-insensitive for lookup.
    const pathEdges = new Set<string>()
    for (let i = 0; i < path.length - 1; i += 1) {
      pathEdges.add([path[i], path[i + 1]].sort().join('::'))
    }

    const flowNodes: Node<GraphNodeData>[] = network.nodes.map((node) => ({
      id: node.id,
      type: 'host',
      position: positions[node.id] ?? { x: 0, y: 0 },
      data: {
        node,
        role: roleOf(node, start, target),
        isHoneypot: honeypotSet.has(node.id),
        isOnPath: pathSet.has(node.id),
        isVisited: visitedSet.has(node.id),
        isAttacker: node.id === attackerPosition,
        isSelected: node.id === selectedNode,
        clickable: Boolean(onSelectNode),
      },
      draggable: false,
      connectable: false,
    }))

    const flowEdges: Edge[] = network.edges.map((edge) => {
      const onPath = pathEdges.has([edge.source, edge.target].sort().join('::'))
      const touchesSelection = selectedNode !== null && (edge.source === selectedNode || edge.target === selectedNode)
      return {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'straight',
        label: String(edge.weight),
        labelStyle: {
          fill: onPath ? COLORS.champagne : COLORS.muted,
          fontSize: 10,
          fontFamily: 'Consolas, ui-monospace, monospace',
        },
        labelBgStyle: { fill: '#0B0B0C', stroke: onPath ? COLORS.gold : COLORS.border, strokeWidth: 1 },
        labelBgPadding: [5, 3] as [number, number],
        labelBgBorderRadius: 3,
        style: {
          stroke: onPath ? COLORS.gold : touchesSelection ? COLORS.borderStrong : COLORS.edge,
          strokeWidth: onPath ? 2.25 : touchesSelection ? 1.6 : 1.2,
        },
      }
    })

    return { nodes: flowNodes, edges: flowEdges }
  }, [network, path, honeypots, visitedNodes, attackerPosition, selectedNode, onSelectNode, start, target])

  return (
    <div className={`${heightClass} w-full overflow-hidden rounded-lg border border-line bg-well`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.06, maxZoom: 1.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={Boolean(onSelectNode)}
        onNodeClick={onSelectNode ? (_, node) => onSelectNode(node.id) : undefined}
        onPaneClick={onSelectNode ? () => onSelectNode(null) : undefined}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={1.8}
      >
        <Background variant={BackgroundVariant.Lines} color="#171614" gap={32} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  )
}

/** Shared legend so every graph view explains the same marks. */
export function GraphLegend() {
  const items: { label: string; glyph: React.ReactNode }[] = [
    { label: 'Entry point', glyph: <RoleGlyph role="entry" /> },
    { label: 'Protected asset', glyph: <RoleGlyph role="target" /> },
    { label: 'Honeypot candidate', glyph: <RoleGlyph role="candidate" /> },
    { label: 'Deployed decoy', glyph: <RoleGlyph role="candidate" decoy /> },
    { label: 'Host', glyph: <RoleGlyph role="host" /> },
    {
      label: 'Analysed route',
      glyph: <span className="inline-block h-0.5 w-4 rounded bg-gold" aria-hidden />,
    },
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="Graph legend">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-fg-muted">
          {item.glyph}
          {item.label}
        </li>
      ))}
    </ul>
  )
}
