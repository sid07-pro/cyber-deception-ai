/**
 * types.ts
 * TypeScript mirrors of the backend Pydantic schemas.
 * Keep in sync with backend/app/schemas/{network,simulation}.py.
 */

export type Criticality = 'high' | 'medium' | 'low'

export interface NetworkNode {
  id: string
  name: string
  type: string
  criticality: Criticality
  metadata: Record<string, unknown>
}

export interface NetworkEdge {
  source: string
  target: string
  weight: number
}

export interface NetworkResponse {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  attacker_start: string
  critical_target: string
  honeypot_candidates: string[]
}

export const SEARCH_ALGORITHMS = ['BFS', 'DFS', 'UCS', 'A*'] as const
export type SearchAlgorithm = (typeof SEARCH_ALGORITHMS)[number]

export type SimulationOutcome = 'intercepted' | 'target_reached' | 'no_path'

export interface SimulationRequest {
  algorithm: SearchAlgorithm
  start_node?: string | null
  target_node?: string | null
  honeypot_count?: number
}

export interface HoneypotScore {
  node: string
  attack_path_frequency: number
  target_proximity: number
  node_connectivity: number
  deployment_cost: number
  deception_score: number
  selected: boolean
}

export interface AlgorithmComparison {
  algorithm: string
  path: string[]
  cost: number
  nodes_explored: number
}

export interface SimulationResponse {
  algorithm: SearchAlgorithm
  start_node: string
  target_node: string
  path: string[]
  path_cost: number
  nodes_explored: number | null
  honeypots: string[]
  honeypot_scores: HoneypotScore[]
  result: SimulationOutcome
  intercepted_at: string | null
  intercepted_at_step: number | null
  algorithm_comparison: AlgorithmComparison[]
  explanation: string[]
}

// ---- Stepped simulation sessions (Milestone 3) ----

export type SimulationStatus = 'ready' | 'running' | 'completed'
export type SessionOutcome = 'intercepted' | 'target_reached' | 'failed' | 'invalid'

export interface StartSimulationRequest {
  algorithm: SearchAlgorithm
  start_node?: string | null
  target_node?: string | null
  honeypot_budget?: number
}

export interface SimulationEvent {
  step: number
  kind: string
  node: string | null
  message: string
}

export interface ProtectionSummary {
  covered_nodes: number
  path_coverage: number
  risk_level: string
}

export interface SimulationStateResponse {
  session_id: string
  algorithm: SearchAlgorithm
  start_node: string
  target_node: string
  honeypot_budget: number
  predicted_path: string[]
  path_cost: number
  nodes_explored: number
  honeypots: string[]
  honeypot_scores: HoneypotScore[]
  attacker_position: string
  path_index: number
  visited_nodes: string[]
  compromised_nodes: string[]
  time_step: number
  status: SimulationStatus
  outcome: SessionOutcome | null
  is_complete: boolean
  current_event: SimulationEvent | null
  events: SimulationEvent[]
  explanation: string[]
  protection: ProtectionSummary
}
