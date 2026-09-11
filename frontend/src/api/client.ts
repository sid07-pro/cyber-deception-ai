/**
 * client.ts
 * Minimal typed fetch wrapper for the backend API.
 *
 * When VITE_API_BASE_URL is empty the requests go to the same origin and are
 * forwarded by the Vite dev proxy to the FastAPI server.
 */

import type {
  AIAnalyzeRequest,
  AIAnalyzeResponse,
  ExperimentRequest,
  ExperimentResponse,
  NetworkResponse,
  PlanRequest,
  PlanResponse,
  SaveCurrentNetworkRequest,
  SaveExperimentRequest,
  ScenarioResponse,
  ScenarioSummary,
  SimulationRequest,
  SimulationResponse,
  SimulationStateResponse,
  StartSimulationRequest,
  StoredExperimentSummary,
} from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface HealthResponse {
  status: string
  service: string
  version: string
}

/** Turns a non-2xx response into an Error carrying the backend's `detail`, when present. */
async function toError(response: Response, path: string): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') {
      return new Error(body.detail)
    }
  } catch {
    // Body was not JSON; fall through to the generic message.
  }
  return new Error(`Request to ${path} failed with status ${response.status}`)
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, { signal })

  if (!response.ok) {
    throw await toError(response, path)
  }

  return (await response.json()) as T
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw await toError(response, path)
  }

  return (await response.json()) as T
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health', signal)
}

export function getNetwork(signal?: AbortSignal): Promise<NetworkResponse> {
  return apiGet<NetworkResponse>('/network', signal)
}

export function runSimulation(
  request: SimulationRequest,
  signal?: AbortSignal,
): Promise<SimulationResponse> {
  return apiPost<SimulationResponse>('/simulate', request, signal)
}

export function startSession(
  request: StartSimulationRequest,
  signal?: AbortSignal,
): Promise<SimulationStateResponse> {
  return apiPost<SimulationStateResponse>('/simulation/start', request, signal)
}

export function stepSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SimulationStateResponse> {
  return apiPost<SimulationStateResponse>('/simulation/step', { session_id: sessionId }, signal)
}

export function resetSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SimulationStateResponse> {
  return apiPost<SimulationStateResponse>('/simulation/reset', { session_id: sessionId }, signal)
}

export function analyzeWithAI(
  request: AIAnalyzeRequest,
  signal?: AbortSignal,
): Promise<AIAnalyzeResponse> {
  return apiPost<AIAnalyzeResponse>('/ai/analyze', request, signal)
}

export function createPlan(
  request: PlanRequest,
  signal?: AbortSignal,
): Promise<PlanResponse> {
  return apiPost<PlanResponse>('/planning/plan', request, signal)
}

export function runExperiment(
  request: ExperimentRequest,
  signal?: AbortSignal,
): Promise<ExperimentResponse> {
  return apiPost<ExperimentResponse>('/experiments/run', request, signal)
}

export function getExperiment(
  experimentId: string,
  signal?: AbortSignal,
): Promise<ExperimentResponse> {
  return apiGet<ExperimentResponse>(`/experiments/${experimentId}`, signal)
}

export function saveCurrentNetwork(
  request: SaveCurrentNetworkRequest,
  signal?: AbortSignal,
): Promise<ScenarioResponse> {
  return apiPost<ScenarioResponse>('/scenarios/save-current', request, signal)
}

export function listScenarios(signal?: AbortSignal): Promise<ScenarioSummary[]> {
  return apiGet<ScenarioSummary[]>('/scenarios', signal)
}

export function getScenario(
  scenarioId: number,
  signal?: AbortSignal,
): Promise<ScenarioResponse> {
  return apiGet<ScenarioResponse>(`/scenarios/${scenarioId}`, signal)
}

export async function deleteScenario(scenarioId: number, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/scenarios/${scenarioId}`, {
    method: 'DELETE',
    signal,
  })
  if (!response.ok) {
    throw await toError(response, `/scenarios/${scenarioId}`)
  }
}

export function saveExperiment(
  request: SaveExperimentRequest,
  signal?: AbortSignal,
): Promise<unknown> {
  return apiPost('/experiments/save', request, signal)
}

export function listStoredExperiments(
  signal?: AbortSignal,
): Promise<StoredExperimentSummary[]> {
  return apiGet<StoredExperimentSummary[]>('/experiments-history', signal)
}
