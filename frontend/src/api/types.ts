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

// ---- Advanced AI techniques (Milestone 4) ----

export const AI_TECHNIQUES = [
  'minimax',
  'alpha_beta',
  'bayesian',
  'hill_climbing',
  'genetic_algorithm',
] as const
export type AITechnique = (typeof AI_TECHNIQUES)[number]

export const AI_TECHNIQUE_LABELS: Record<AITechnique, string> = {
  minimax: 'Minimax',
  alpha_beta: 'Alpha-Beta',
  bayesian: 'Bayesian Risk',
  hill_climbing: 'Hill Climbing',
  genetic_algorithm: 'Genetic Algorithm',
}

export interface AIAnalyzeRequest {
  technique: AITechnique
  start_node?: string | null
  target_node?: string | null
  honeypot_budget?: number
  depth?: number
  seed?: number
  algorithm?: SearchAlgorithm
}

export interface AIAnalyzeResponse {
  technique: AITechnique
  start_node: string
  target_node: string
  recommendation: string
  score: number
  probability: number | null
  honeypots: string[]
  metrics: Record<string, unknown>
  explanation: string[]
}

// ---- Planning and experiments (Milestone 5) ----

export const PLANNING_METHODS = ['forward', 'backward'] as const
export type PlanningMethod = (typeof PLANNING_METHODS)[number]

export const GOAL_TYPES = ['protect_target', 'intercept_attacker', 'contain_breach'] as const
export type GoalType = (typeof GOAL_TYPES)[number]

export const GOAL_LABELS: Record<GoalType, string> = {
  protect_target: 'Protect the target',
  intercept_attacker: 'Intercept the attacker',
  contain_breach: 'Contain the breach',
}

export interface PlanRequest {
  method: PlanningMethod
  start_node?: string | null
  target_node?: string | null
  honeypot_budget?: number
  max_depth?: number
  goal_type?: GoalType
}

export interface PlanAction {
  name: string
  parameters: string[]
  cost: number
  description: string
}

export interface PlanResponse {
  method: PlanningMethod
  goal_type: GoalType
  goal: string
  start_node: string
  target_node: string
  honeypot_budget: number
  max_depth: number
  success: boolean
  actions: PlanAction[]
  plan_length: number
  plan_cost: number
  explored_states: number
  final_state: string[]
  reason: string
  explanation: string[]
}

export const HONEYPOT_STRATEGIES = [
  'none',
  'random',
  'greedy',
  'hill_climbing',
  'genetic_algorithm',
] as const
export type HoneypotStrategy = (typeof HONEYPOT_STRATEGIES)[number]

export const STRATEGY_LABELS: Record<HoneypotStrategy, string> = {
  none: 'No deception',
  random: 'Random placement',
  greedy: 'Greedy (deception score)',
  hill_climbing: 'Hill Climbing',
  genetic_algorithm: 'Genetic Algorithm',
}

export interface ExperimentRequest {
  algorithm: SearchAlgorithm
  strategy: HoneypotStrategy
  honeypot_budget?: number
  runs?: number
  seed?: number
  start_node?: string | null
  target_node?: string | null
  compare_strategies?: boolean
}

export interface ExperimentMetrics {
  total_runs: number
  successful_attacks: number
  intercepted_attacks: number
  deception_success_rate: number
  attack_success_rate: number
  average_path_cost: number
  average_nodes_explored: number
  average_steps: number
  average_execution_ms: number
  average_honeypot_count: number
  average_fitness: number
}

export interface StrategyComparison extends ExperimentMetrics {
  strategy: HoneypotStrategy
}

export interface RunSummary {
  run: number
  seed: number
  outcome: string
  path_cost: number
  nodes_explored: number
  steps: number
  honeypots: string[]
  honeypot_count: number
  intercepted_at: string | null
  fitness: number
  execution_ms: number
}

export interface ExperimentResponse {
  experiment_id: string
  configuration: Record<string, unknown>
  metrics: ExperimentMetrics
  strategy_comparison: StrategyComparison[]
  runs: RunSummary[]
  truncated_runs: number
  explanation: string[]
}

// ---- Persistence (Milestone 6) ----

export interface ScenarioSummary {
  id: number
  name: string
  description: string
  attacker_start: string
  critical_target: string
  created_at: string
  node_count: number
  edge_count: number
  experiment_count: number
}

export interface ScenarioResponse extends NetworkResponse {
  id: number
  name: string
  description: string
  created_at: string
  experiment_count: number
}

export interface SaveCurrentNetworkRequest {
  name: string
  description?: string
}

export interface SaveExperimentRequest {
  experiment_id: string
  scenario_id?: number | null
}

export interface StoredExperimentSummary {
  experiment_id: string
  scenario_id: number | null
  created_at: string
  algorithm: SearchAlgorithm
  strategy: HoneypotStrategy
  honeypot_budget: number
  runs: number
  seed: number
  deception_success_rate: number
  attack_success_rate: number
}
