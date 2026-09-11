# Methodology

> **Simulation only.** The network is a small synthetic graph. No real hosts, addresses,
> credentials, exploits, or offensive techniques exist anywhere in this project. The "attacker"
> is a search algorithm walking a weighted graph.

## Simulation workflow

1. **Network state** — the topology is a weighted `networkx` graph; edge weights represent the
   simulated difficulty of moving between hosts.
2. **Attacker agent** — a goal-based agent predicts a route to the critical asset using the
   selected search algorithm.
3. **Defender agent** — a utility-based agent scores candidate hosts and spends its honeypot
   budget. The attacker's entry point and the protected asset are never eligible.
4. **Execution** — the attacker walks the predicted route one hop per time step.
5. **Outcome** — `intercepted` (a honeypot was reached), `target_reached` (the asset fell),
   `failed` (no route exists), or `invalid` (start and target are the same node).
6. **Explanation** — every decision is reported in plain language alongside the numbers behind it.

## AI techniques implemented

| Technique | Module | Notes |
| --- | --- | --- |
| BFS | `ai/bfs.py` | Uninformed; fewest hops, ignores weights. |
| DFS | `ai/dfs.py` | Uninformed; iterative, explicit stack. |
| UCS | `ai/ucs.py` | Lowest cumulative cost first; optimal for weights. |
| A* | `ai/astar.py` | `f(n) = g(n) + h(n)`; `h` is BFS hop distance × minimum edge weight, which is admissible. |
| Attacker agent | `ai/attacker.py` | Selects and runs a strategy. |
| Defender agent | `ai/defender.py`, `ai/optimizer.py` | Deception score = (path frequency + target proximity + connectivity) ÷ deployment cost. |
| Minimax | `ai/minimax.py` | Full search over `ai/deception_game.py`; configurable depth. |
| Alpha-Beta | `ai/alpha_beta.py` | Same interface and result as Minimax, fewer states expanded; reports pruned branches. |
| Bayesian risk | `ai/bayesian.py` | Posterior compromise probability per host; route risk by the complement rule. |
| Hill Climbing | `ai/hill_climbing.py` | Steepest ascent with seeded random restarts. |
| Genetic Algorithm | `ai/genetic.py` | Tournament selection, crossover with repair, elitism, seeded mutation. |
| Planning | `ai/planning.py` | STRIPS-style domain; forward progression and backward regression. |

### The adversarial game

MAX is the attacker (one hop per turn); MIN is the defender (place a honeypot, or pass). A
position is terminal when the attacker is intercepted or reaches the asset. Utility is scored
from the attacker's view and combines five factors: progress toward the target, nodes
compromised, protection of the asset, deception success, and movement plus deployment cost.
Terminal states dominate the positional terms.

### Bayesian assumptions

- Prior that a host lies on the attack route comes from its connectivity relative to the
  best-connected host, offset by a base rate.
- Evidence items are treated as conditionally independent given the hypothesis, so posteriors
  chain as successive priors.
- Per-host compromise events are treated as independent, so route risk is `1 − Π(1 − pᵢ)`.

These likelihoods are chosen by hand, not learned. They are transparent and explainable, not
empirical.

### Placement fitness

Both optimizers maximize one shared function (`ai/fitness.py`):

```
fitness = 4·coverage + 2·proximity + 1·criticality + 1.5·deception − 1·cost
```

Each term is normalized to roughly `[0, 1]` before weighting, so the weights read directly as
relative importance. Seeded generators make every run reproducible.

### Planning domain

Actions: `place_honeypot`, `move_attacker`, `block_route`, `increase_protection`,
`monitor_node`, `isolate_node`. Goals: `protect_target`, `intercept_attacker`, `contain_breach`.
Both planners deduplicate visited states and cap depth and explored states, so neither can loop.
The honeypot budget is enforced by counting `honeypot(...)` literals rather than modelling
numeric fluents; backward search validates each candidate by replaying it forward, so regression
cannot return a plan that exceeds the budget.

## Experiment metrics

| Metric | Meaning |
| --- | --- |
| `total_runs` | Simulations executed (capped at 100). |
| `intercepted_attacks` / `successful_attacks` | Run counts by outcome. |
| `deception_success_rate` | Share of runs where a honeypot intercepted the attacker. |
| `attack_success_rate` | Share of runs where the attacker reached the asset. |
| `average_path_cost` | Mean total edge weight of the predicted route. |
| `average_steps` | Mean hops before the run ended. |
| `average_nodes_explored` | Mean states expanded by the attacker search. |
| `average_execution_ms` | Mean wall-clock time per run. |
| `average_honeypot_count` | Mean honeypots actually deployed. |
| `average_fitness` | Mean placement fitness. |

Strategies compared: `none`, `random`, `greedy`, `hill_climbing`, `genetic_algorithm`. Each run
uses `seed + index`, so a seeded experiment is reproducible except for wall-clock timing.

## Limitations

- The topology is small, fixed, and synthetic; results do not generalise to real infrastructure.
- The attacker commits to one predicted route and does not re-plan when blocked or deceived.
- Bayesian priors and likelihoods are hand-chosen rather than learned.
- Minimax and Alpha-Beta run to a shallow fixed depth, so their values are heuristic.
- Deployment costs are fixed per host type rather than economically modelled.
- Step-by-step sessions live in process memory and are lost on restart — by design.

## Future improvements

- Adaptive attackers that re-plan when a route is blocked or a honeypot is detected.
- Bayesian parameters estimated from simulated telemetry instead of fixed likelihoods.
- Editable topologies in the UI, saved straight into the scenario store.
- Deeper adversarial search with move ordering and transposition tables.
- Alembic migrations if the schema starts changing in non-additive ways.
