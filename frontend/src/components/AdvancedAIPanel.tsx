/**
 * AdvancedAIPanel.tsx
 * Runs one advanced AI technique over the current scenario and shows its
 * recommendation, score, and reasoning.
 */

import { useState } from 'react'
import { analyzeWithAI } from '../api/client'
import {
  AI_TECHNIQUES,
  AI_TECHNIQUE_LABELS,
  type AIAnalyzeResponse,
  type AITechnique,
} from '../api/types'
import type { SimulationSettings } from './SimulationControls'

type AnalysisState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; result: AIAnalyzeResponse }
  | { kind: 'error'; message: string }

const NEEDS_DEPTH: AITechnique[] = ['minimax', 'alpha_beta']
const NEEDS_SEED: AITechnique[] = ['hill_climbing', 'genetic_algorithm']

const SELECT_CLASS =
  'mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100'

export function AdvancedAIPanel({ settings }: { settings: SimulationSettings }) {
  const [technique, setTechnique] = useState<AITechnique>('minimax')
  const [depth, setDepth] = useState(4)
  const [seed, setSeed] = useState(0)
  const [state, setState] = useState<AnalysisState>({ kind: 'idle' })

  const handleAnalyze = () => {
    setState({ kind: 'loading' })
    analyzeWithAI({
      technique,
      start_node: settings.startNode,
      target_node: settings.targetNode,
      honeypot_budget: settings.honeypotCount,
      depth,
      seed,
      algorithm: settings.algorithm,
    })
      .then((result) => setState({ kind: 'done', result }))
      .catch((error: unknown) =>
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
  }

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">Advanced AI analysis</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm lg:col-span-2">
          <span className="text-slate-400">Technique</span>
          <select
            aria-label="Technique"
            className={SELECT_CLASS}
            value={technique}
            onChange={(event) => setTechnique(event.target.value as AITechnique)}
          >
            {AI_TECHNIQUES.map((name) => (
              <option key={name} value={name}>
                {AI_TECHNIQUE_LABELS[name]}
              </option>
            ))}
          </select>
        </label>

        {NEEDS_DEPTH.includes(technique) && (
          <label className="text-sm">
            <span className="text-slate-400">Search depth</span>
            <select
              aria-label="Search depth"
              className={SELECT_CLASS}
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}

        {NEEDS_SEED.includes(technique) && (
          <label className="text-sm">
            <span className="text-slate-400">Random seed</span>
            <input
              aria-label="Random seed"
              type="number"
              min={0}
              className={SELECT_CLASS}
              value={seed}
              onChange={(event) => setSeed(Math.max(0, Number(event.target.value)))}
            />
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={state.kind === 'loading'}
        className="mt-4 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {state.kind === 'loading' ? 'Analyzing…' : 'Run Analysis'}
      </button>

      {state.kind === 'loading' && (
        <p className="mt-3 text-sm text-slate-400">Running {AI_TECHNIQUE_LABELS[technique]}…</p>
      )}

      {state.kind === 'error' && (
        <div className="mt-3 rounded border border-red-800 bg-slate-950 p-3">
          <p className="font-semibold text-red-400">Analysis failed</p>
          <p className="mt-1 text-sm text-slate-400">{state.message}</p>
        </div>
      )}

      {state.kind === 'idle' && (
        <p className="mt-3 text-sm text-slate-400">
          No analysis yet. Pick a technique and select Run Analysis.
        </p>
      )}

      {state.kind === 'done' && <AnalysisResult result={state.result} />}
    </section>
  )
}

function AnalysisResult({ result }: { result: AIAnalyzeResponse }) {
  return (
    <div className="mt-4 rounded border border-violet-900 bg-slate-950 p-3">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Technique</dt>
          <dd className="text-slate-200">{AI_TECHNIQUE_LABELS[result.technique]}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Score</dt>
          <dd className="tabular-nums text-slate-200">{result.score}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Recommendation</dt>
          <dd className="text-violet-300">{result.recommendation}</dd>
        </div>
        {result.probability !== null && (
          <div>
            <dt className="text-slate-500">Route compromise probability</dt>
            <dd className="tabular-nums text-slate-200">{result.probability}</dd>
          </div>
        )}
        {result.honeypots.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Recommended honeypots</dt>
            <dd className="text-amber-300">{result.honeypots.join(', ')}</dd>
          </div>
        )}
      </dl>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
        {result.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
