/**
 * client.ts
 * Minimal typed fetch wrapper for the backend API.
 *
 * When VITE_API_BASE_URL is empty the requests go to the same origin and are
 * forwarded by the Vite dev proxy to the FastAPI server.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface HealthResponse {
  status: string
  service: string
  version: string
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, { signal })

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health', signal)
}
