/**
 * AboutPage.tsx
 * Methodology, metrics, and limitations — the material a reviewer asks about.
 */

const TECHNIQUES: [string, string][] = [
  ['BFS', 'Uninformed search; fewest hops, ignores link weights.'],
  ['DFS', 'Uninformed search; explores one branch fully before backtracking.'],
  ['UCS', 'Informed by cost only; guarantees the cheapest route.'],
  ['A*', 'f(n) = g(n) + h(n) with an admissible hop-distance heuristic.'],
  ['Minimax', 'Attacker versus defender as a zero-sum game over a bounded depth.'],
  ['Alpha-Beta', 'Same result as Minimax, fewer states expanded.'],
  ['Bayesian risk', 'Posterior compromise probability per host from priors and evidence.'],
  ['Hill Climbing', 'Steepest-ascent placement search with seeded random restarts.'],
  ['Genetic Algorithm', 'Population-based placement search with elitism and mutation.'],
  ['Planning', 'Forward progression and backward regression over a STRIPS-style domain.'],
]

const METRICS: [string, string][] = [
  ['Deception success rate', 'Share of runs where a honeypot intercepted the attacker.'],
  ['Attack success rate', 'Share of runs where the attacker reached the protected asset.'],
  ['Average path cost', 'Mean total edge weight of the predicted route.'],
  ['Average steps', 'Mean hops taken before the run ended.'],
  ['Average nodes explored', 'Mean states expanded by the attacker search.'],
  ['Average fitness', 'Mean placement score: coverage, proximity, criticality, deception, cost.'],
]

const LIMITATIONS = [
  'The network is a small fixed synthetic topology; results do not generalise to real infrastructure.',
  'The attacker is assumed to follow one predicted route and does not re-plan mid-attack.',
  'Bayesian priors and likelihoods are chosen by hand, not learned from data.',
  'Minimax and Alpha-Beta run to a shallow fixed depth, so their values are heuristic.',
  'Honeypot deployment costs are fixed per host type rather than modelled economically.',
]

const FUTURE = [
  'Adaptive attackers that re-plan when a route is blocked or a honeypot is detected.',
  'Learned Bayesian parameters from simulated telemetry instead of fixed likelihoods.',
  'Editable topologies in the UI, saved straight into the scenario store.',
  'Deeper adversarial search with move ordering and transposition tables.',
]

export function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-amber-800 bg-slate-900 p-4">
        <h2 className="font-semibold text-amber-400">Simulation only</h2>
        <p className="mt-1 text-sm text-slate-300">
          Everything here is a synthetic, self-contained simulation for coursework. There are no
          real hosts, addresses, credentials, exploits, or offensive capabilities anywhere in this
          project — the &ldquo;attacker&rdquo; is a search algorithm walking a graph.
        </p>
      </section>

      <Section title="Simulation workflow">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>The network is loaded as a weighted graph (state space).</li>
          <li>The attacker agent predicts a route with the selected search algorithm.</li>
          <li>The defender agent scores candidate hosts and spends its honeypot budget.</li>
          <li>The attacker walks the route one hop per step.</li>
          <li>The run ends when a honeypot intercepts it or it reaches the protected asset.</li>
          <li>Every decision is reported with a plain-language explanation.</li>
        </ol>
      </Section>

      <Section title="AI techniques implemented">
        <DefinitionList items={TECHNIQUES} />
      </Section>

      <Section title="Experiment metrics">
        <DefinitionList items={METRICS} />
      </Section>

      <Section title="Limitations">
        <BulletList items={LIMITATIONS} />
      </Section>

      <Section title="Future improvements">
        <BulletList items={FUTURE} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-semibold text-slate-100">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function DefinitionList({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map(([term, description]) => (
        <div key={term} className="rounded border border-slate-800 bg-slate-950 px-3 py-2">
          <dt className="text-sm font-medium text-slate-200">{term}</dt>
          <dd className="mt-0.5 text-sm text-slate-400">{description}</dd>
        </div>
      ))}
    </dl>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
