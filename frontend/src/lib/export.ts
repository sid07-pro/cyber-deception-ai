/**
 * export.ts
 * Client-side downloads for experiment results — JSON and CSV.
 *
 * Everything is built in the browser from data already on screen; nothing is
 * uploaded, stored server-side, or persisted.
 */

import type { ExperimentResponse } from '../api/types'

/** Quotes a CSV field only when it needs it. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Aggregate metrics plus the per-strategy comparison, as CSV text. */
export function experimentToCsv(experiment: ExperimentResponse): string {
  const metricKeys = Object.keys(experiment.metrics) as (keyof ExperimentResponse['metrics'])[]

  const lines = [
    ['section', 'strategy', ...metricKeys].map(csvCell).join(','),
    [
      'overall',
      String(experiment.configuration.strategy ?? ''),
      ...metricKeys.map((key) => experiment.metrics[key]),
    ]
      .map(csvCell)
      .join(','),
  ]

  for (const row of experiment.strategy_comparison) {
    lines.push(
      ['comparison', row.strategy, ...metricKeys.map((key) => row[key])].map(csvCell).join(','),
    )
  }

  return lines.join('\n')
}

/** Triggers a browser download of `content` as `filename`. */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadExperimentJson(experiment: ExperimentResponse): void {
  downloadFile(
    `experiment-${experiment.experiment_id}.json`,
    JSON.stringify(experiment, null, 2),
    'application/json',
  )
}

export function downloadExperimentCsv(experiment: ExperimentResponse): void {
  downloadFile(
    `experiment-${experiment.experiment_id}.csv`,
    experimentToCsv(experiment),
    'text/csv',
  )
}
