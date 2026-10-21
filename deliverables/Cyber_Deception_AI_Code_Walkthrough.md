# Cyber Deception AI — Code Walkthrough

This document maps the real source code to the presentation. Every file and function named here exists in the repository (checked 2026-10-21).

Paths are relative to `D:\cyber-deception-ai`.

---

## 0. One request, end to end

This traces a single **Run Simulation** click through the whole stack. The feature is complete; there are no gaps in this flow.

| # | Layer | File · function | What happens |
|---|---|---|---|
| 1 | UI | `frontend/src/components/SimulationControls.tsx` → `onRun` | The button is disabled if start = target or either is missing |
| 2 | UI state | `frontend/src/components/SimulationPanel.tsx` · `handleRun()` | Sets `running`, clears any stepped session, calls the API |
| 3 | API client | `frontend/src/api/client.ts` · `runSimulation()` → `apiPost('/simulate', body)` | `fetch('/api/simulate')`; on a non-2xx response it throws `Error(detail)` |
| 4 | Dev proxy | `frontend/vite.config.ts` | `/api` is forwarded to `http://localhost:8000` (or `backend:8000` in Docker) |
| 5 | Route | `backend/app/api/routes/simulation.py` · `simulate()` | Pydantic validates the body; loads the scenario if `scenario_id` is set |
| 6 | Schema | `backend/app/schemas/simulation.py` · `SimulationRequest` | `algorithm` enum (BFS/DFS/UCS/A*), `honeypot_count` 0–5, `scenario_id` ≥ 1 |
| 7 | Service | `backend/app/services/simulation_service.py` · `run_simulation()` | Builds the graph, runs the attacker and defender, computes the outcome |
| 8 | Graph | `backend/simulation/network.py` · `build_network()`, or `simulation_service.graph_from_scenario()` | Returns an `nx.Graph` with `role` and `weight` attributes |
| 9 | Attacker | `backend/ai/attacker.py` · `run_all_algorithms()`, `select_attacker_path()` | All four searches run; the chosen one becomes the attacker's path |
| 10 | Defender | `backend/ai/defender.py` · `plan_defense()` → `backend/ai/optimizer.py` · `score_candidates()` | Scores the candidates and picks the top k |
| 11 | Outcome | `ai/defender.py` · `evaluate_interception()`; `simulation_service.alternative_paths()`; `simulation/simulator.py` · `generate_explanations()` | Interception point, Yen routes, explanation text |
| 12 | Response | `SimulationResponse` | Serialised to JSON |
| 13 | Render | `ResultPanel.tsx`, `NetworkGraph.tsx`, `HistoryList.tsx`; `App.tsx` stores the history so `DashboardPage.tsx` can show it | Gold route, decoy tags, score tables, explanations |

**Error paths:**
- An unknown node raises `UnknownNodeError`, which returns **404**. The UI shows "Simulation failed" with the server's message.
- A bad body fails validation and returns **422**.
- An unknown `scenario_id` returns **404**.
- If the database is down while loading a scenario, the route returns **503**.

---

## 1. `backend/simulation/network.py` — the network model

- **Purpose:** defines the synthetic topology.
- **Key items:**
  - `NODE_ROLES` (`normal`, `honeypot_candidate`, `critical`);
  - `EDGES`, a list of `(u, v, cost)`;
  - `ATTACKER_START = "Internet"`, `CRITICAL_TARGET = "Database"`;
  - `build_network()`, which returns `nx.Graph`;
  - `honeypot_candidates(g)`.
- **Key lines:** `g.add_node(node, role=role)` stores the role as a node attribute. `g.add_edge(u, v, weight=cost)` stores the weight.
- **Tests:** `tests/test_search.py`, `tests/test_simulation_api.py` (`GET /api/network`).
- **Viva Q:** *Why NetworkX?* It is a well-tested graph structure with an adjacency list, degree, and shortest-path helpers. The search algorithms themselves are written by hand.

## 2. `backend/ai/bfs.py`, `dfs.py`, `ucs.py`, `astar.py` — the four searches

- **Shared signature:** `search(graph, start, goal) -> (path, cost, nodes_explored)`.
- **Guard (added during recovery):** `if start not in graph or goal not in graph: return [], 0, 0`.

**`bfs_search`**
- `frontier = deque([start])`, plus a `visited` set and a `parent` dict.
- `_reconstruct_path(parent, goal)` walks the parent pointers back from the goal.
- `_path_cost` sums the edge weights.

**`dfs_search`**
- `stack = [(start, [start])]`.
- Neighbours are pushed in reverse so the first neighbour is explored first.
- A node already in `visited` is skipped when popped.

**`ucs_search`** — the core loop, line by line:
1. `cost, _, current, path = heapq.heappop(frontier)` takes the cheapest entry. `_` is the tie-break counter.
2. `if current in visited: continue` skips a stale entry, i.e. a cheaper copy was already finalised.
3. `visited.add(current); nodes_explored += 1` finalises the node.
4. `if current == goal: return path, cost, nodes_explored` returns at **pop** time, which is what guarantees optimality.
5. For each neighbour: `new_cost = cost + graph[current][neighbor]["weight"]`.
6. `if neighbor not in best_cost or new_cost < best_cost[neighbor]`: this is the Dijkstra relaxation check.
7. `heapq.heappush(frontier, (new_cost, counter, neighbor, path + [neighbor]))`.

**`astar_search`**
- `_build_heuristic(graph, goal)` runs BFS hop distances outward from the goal and multiplies each by `min_weight`. `min(..., default=0)` handles graphs with no edges.
- Frontier entries are `(f, counter, node, g, path)`, and the heap is ordered by f = g + h.

**Tests:**
- `tests/test_search.py` (4): valid paths; UCS equals the brute-force minimum; A* equals UCS.
- `tests/test_search_edge_cases.py` (31): unreachable targets, cycles, start = goal, unknown nodes, no edges, BFS-vs-UCS disagreement, random graphs compared with NetworkX.

**Viva Q:** *Why the counter?* It gives deterministic tie-breaking and stops Python from comparing strings or lists when costs are equal.

## 3. `backend/ai/attacker.py` — the attacker agent's choices

- `ALGORITHMS` dict: name → function.
- `run_all_algorithms(graph, start, goal)` returns `{name: {path, cost, nodes_explored}}`.
- `select_attacker_path(graph, start, goal, strategy)` returns the chosen result plus `strategy`.
- **Used by:** `simulation_service`, `app/services/agents.py` (`AttackerAgent`), `experiment_service`.

## 4. `backend/ai/optimizer.py` and `defender.py` — honeypot placement

**`optimizer.py`**
- `DEPLOYMENT_COST` holds the simulated costs per host.
- Helper terms:
  - `_attack_path_frequency(node, candidate_paths)`: how many paths contain the node;
  - `_target_proximity(graph, node, target)`: `1/(dist+1)`, where dist is `nx.shortest_path_length` (unweighted hops);
  - `_node_connectivity(graph, node)`: the node's degree.
- `score_candidates(graph, candidate_paths, candidates, target, top_n=2, deployment_costs=None)`:
  - computes `raw_score = (freq + proximity + connectivity) / cost`;
  - sorts in descending order;
  - returns `(table, selected)`.
  - `deployment_costs` overrides the default costs for saved scenarios.

**`defender.py`**
- `plan_defense(...)` wraps `score_candidates`.
- `evaluate_interception(path, honeypots)` returns the first honeypot on the path and its index.

**Tests:** `tests/test_simulation_api.py`, `tests/test_scenario_simulation.py` (custom costs, e.g. Relay = 5).

**Viva Q:** *Why is Employee PC selected?* Its degree is 3 and its cost is 1, so its score is (0 + 0.333 + 3)/1 = 3.333, even though no predicted path uses it.

## 5. `backend/app/services/simulation_service.py` — orchestration

- `get_network()` returns the serialisable topology (nodes with role, criticality and metadata; edges; candidates).
- `graph_from_scenario(scenario)` rebuilds an `nx.Graph` from a saved scenario and collects any positive `deployment_cost` values from node metadata.
- `alternative_paths(graph, start, target, honeypots, limit=3)` runs Yen's algorithm via `nx.shortest_simple_paths` and returns rank, path, cost, hops, the honeypots on the path, and whether it is intercepted.
- `run_simulation(algorithm, start_node, target_node, honeypot_count, scenario=None)` runs the full pipeline. Candidates always exclude the start and target nodes.
- **Errors:** `UnknownNodeError`, `UnsupportedAlgorithmError`.

## 6. `backend/simulation/simulator.py` — explanations

- `run_full_simulation()` is the original prototype pipeline, still used by `legacy/app.py`.
- `_generate_explanations(decision, honeypots, table, intercepted, hit_node, target)` builds the sentences:
  - which strategy was used, and the path and cost it found;
  - the top-ranked candidate, with its score breakdown;
  - where honeypots were deployed;
  - the outcome: intercepted, target reached, or **no route exists** (the no-route case was fixed during recovery).
- `generate_explanations` is the public alias used by the service.

## 7. `backend/app/services/agents.py` and `deception_engine.py` — stepped simulation

**`agents.py`**
- `AttackerAgent(algorithm)`:
  - `.plan()` returns the attacker's route;
  - `.plausible_paths()` returns the routes from all four algorithms.
- `DefenderAgent(budget).place(...)` performs the greedy placement.

**`deception_engine.py`**
- `start_simulation()`: plan, place the honeypots, store the state.
- `step_simulation(session_id)`: advance the attacker one hop.
- `reset_simulation()`.
- State is held in memory by `session_store.py` (`SessionStore`).

**Routes** (`app/api/routes/session.py`): `start()`, `step()`, `reset()`, i.e. `POST /api/simulation/{start,step,reset}`.

**Verified live:** start with A* places honeypots at {Web Server, Employee PC}. One step moves the attacker to Web Server, with outcome `intercepted` at time step 1.

**Tests:** `tests/test_session_api.py` (8).

## 8. Advanced techniques

### `ai/game.py`
- `Game` protocol: `actions`, `result`, `is_terminal`, `utility`, `is_max`.
- `SearchStats`: nodes visited and branches pruned.

### `ai/deception_game.py`
- `GameState` is a frozen dataclass.
- `UtilityWeights(progress=10, compromise=2, protection=4, deception=50, cost=0.5)`.
- `DeceptionGame.actions()`:
  - the attacker's moves go to sorted neighbours;
  - the defender places a honeypot on an eligible node, or passes.
- `utility()` returns ±50 at terminal states; otherwise it returns the weighted sum.

### `ai/minimax.py`, `ai/alpha_beta.py`
- `minimax(game, state, depth)` and `alpha_beta(game, state, depth)` both return `(action, value, stats)`.
- In Alpha-Beta, `if beta <= alpha: stats.branches_pruned += remaining; break`.

### `ai/bayesian.py`
- `Evidence` dataclass (likelihoods validated to lie in [0, 1]).
- `posterior()` and `sequential_posterior()`.
- `node_prior()` (`BASE_PRIOR = 0.2`), `node_risk()`, and `path_risk()` (1 − Π(1 − p)).

### `ai/fitness.py`
- `FitnessWeights(coverage=4, proximity=2, criticality=1, deception=1.5, cost=1)`.
- `evaluate(graph, placement, candidate_paths, target)` returns the fitness together with its components.

### `ai/hill_climbing.py`, `ai/genetic.py`
- `optimize_placement(graph, candidate_paths, start, target, budget, seed, …)`.
- Hill Climbing generates neighbours with `_neighbours()` (swap, drop, add).
- The GA uses `_random_individual()` and `_repair()`.

### `app/services/ai_registry.py`
- `analyze(technique, …)` dispatches to `_run_game_search`, `_run_bayesian` or `_run_optimizer`.
- **Route:** `app/api/routes/ai.py` · `analyze()`, i.e. `POST /api/ai/analyze`.
- **Tests:** `tests/test_advanced_ai.py` (23, including Alpha-Beta = Minimax), `tests/test_ai_api.py` (14).

## 9. `backend/ai/planning.py` — defensive planning

- `Action` dataclass: name, parameters, preconditions, add effects, delete effects, cost.
- Literal helpers: `at()`, `honeypot()`, `blocked()`, and so on.
- `DefenseDomain.actions()`: place_honeypot (2), move_attacker (edge weight), block_route (3), increase_protection (2), monitor_node (1), isolate_node (2).
- `build_goal()`; `GOAL_TYPES` = protect_target, intercept_attacker, contain_breach.
- `forward_plan()` and `backward_plan()`: both are BFS over states, using `deque`, `MAX_EXPLORED_STATES = 20000`, and a depth limit.
- `validate_plan()`.
- **Service and route:** `app/services/planning_service.py` · `plan()`, and `app/api/routes/planning.py` · `plan()`, i.e. `POST /api/planning/plan`.
- **Tests:** `tests/test_planning.py` (19).

## 10. `backend/app/services/experiment_service.py` — evaluation

- `STRATEGIES = ("none", "random", "greedy", "hill_climbing", "genetic_algorithm")`.
- `_place()` returns the honeypots and fitness for one strategy. `random` uses `random.Random(seed)`.
- `_run_strategy()` runs the requested number of runs and returns per-run summaries (outcome, steps, fitness, execution_ms).
- `_aggregate()` computes the interception and attack success rates and the averages.
- `run_experiment()` returns the report plus the strategy comparison, which it stores in `ExperimentStore` in memory.
- **Routes:** `app/api/routes/experiments.py` · `run()`, `get()`.
- **Tests:** `tests/test_experiments.py` (19).

## 11. Persistence

- `app/db/session.py`:
  - `engine` built from `settings.sqlalchemy_url`;
  - `SessionLocal`;
  - `init_db()`, which calls `create_all`;
  - `get_db()`, the FastAPI dependency.
- `app/models/scenario.py`: `Scenario`, `ScenarioNode`, `ScenarioEdge`, `ExperimentRecord`.
- `app/services/persistence_service.py`:
  - `_validate()`: topology checks on save;
  - `create_scenario()`, `snapshot_of_builtin_network()`, `list_scenarios()`, `get_scenario()`, `delete_scenario()`, `scenario_to_dict()`;
  - functions to save and list experiments.
- **Routes:** `app/api/routes/scenarios.py`. Database errors return 503.
- **Tests:** `tests/test_persistence.py` (23) on a temporary SQLite database (`tests/conftest.py`: `db_session`, `db_client`).

## 12. Configuration and health

- `app/config.py` · `Settings`:
  - `cors_origin_list` combines `ALLOWED_ORIGINS`, `FRONTEND_URL` and `CORS_ORIGINS`, and never emits `*`;
  - `normalize_database_url()` rewrites `postgres://` URLs to use the psycopg driver.
- `app/api/routes/health.py` · `health()` returns status, service, version, environment and database status.
- **Tests:** `tests/test_health.py`, `tests/test_deployment_config.py` (12).

## 13. Frontend modules

| File | Role |
|---|---|
| `src/App.tsx` | Shell: `NAV` groups, `Sidebar`, header (breadcrumb, "Simulated environment" badge, `BackendStatusPill`), shared `settings` and `history`, `Content` page switch |
| `src/components/HealthStatus.tsx` | `useBackendHealth()` polls `/api/health` every 30 s; `BackendStatusPill` |
| `src/components/NetworkGraph.tsx` | `computePositions()` (hop-depth columns, barycentre order, target in the last column); `HostNode` (role glyph and tag); `GraphLegend`; gold route edges |
| `src/components/SimulationPanel.tsx` | Attack Path Analysis workspace: `handleRun`, `withSession` (start, step, reset) |
| `src/components/ResultPanel.tsx` | Outcome badge, key values, deception scoring table with bars, alternative routes, explanations |
| `src/pages/DashboardPage.tsx` | Metrics from `/api/network`, status from health, latest result and recommendations from session history, empty state |
| `src/pages/NetworkTopologyPage.tsx` | Clickable graph, asset inspector, host table, set start/target |
| `src/pages/HoneypotPlacementPage.tsx` | Calls `runSimulation` plus `analyzeWithAI` (hill_climbing, genetic_algorithm) through `settle()`; method comparison; route coverage by set intersection; fitness components |
| `src/components/AdvancedAIPanel.tsx`, `PlanningPanel.tsx`, `ExperimentLab.tsx` | Advanced techniques, planning, experiments; `lib/export.ts` handles JSON/CSV download |
| `src/pages/ScenariosPage.tsx` | Save, list, simulate and delete scenarios; experiment history |
| `src/api/client.ts`, `src/api/types.ts` | Typed client and response types |
| `tailwind.config.js`, `src/index.css` | Design tokens (`ink`, `panel`, `gold`, `fg`, …) and component classes (`panel`, `btn-primary`, `field`, `data-table`) |

**Frontend tests:** 44 Vitest tests across 9 files:
- `App.test.tsx` (navigation, shared history);
- `SimulationPanel.test.tsx`;
- `HoneypotPlacementPage.test.tsx`;
- `NetworkTopologyPage.test.tsx`;
- `ScenariosPage.test.tsx`;
- `AdvancedAIPanel.test.tsx`, `PlanningPanel.test.tsx`, `ExperimentLab.test.tsx`;
- `api/client.test.ts`.

## 14. `legacy/app.py`

- This is the original Streamlit prototype. It is preserved unchanged and is not part of the running stack.
- It imports `simulation.network` and `simulation.simulator`, which now live in `backend/`. Running it therefore needs `PYTHONPATH=backend` plus `streamlit`, `plotly` and `pandas`. It was **not run** during this audit.

---

## Likely viva questions on the code

1. *Where does validation happen?* In the Pydantic schemas (`app/schemas/`), before any service code runs.
2. *Why do services raise custom exceptions instead of HTTP errors?* So the services stay HTTP-agnostic and reusable. The routes map each exception to a status code.
3. *How would you add a fifth search algorithm?* Write `search(graph, start, goal)` in `ai/`, add it to `ALGORITHMS` in `ai/attacker.py`, add its name to the `SearchAlgorithm` enum in `schemas/simulation.py` and to `SEARCH_ALGORITHMS` in `frontend/src/api/types.ts`, and add tests.
4. *How is the graph laid out in the UI?* By BFS depth from the entry point, with the target in its own last column and each column ordered by the mean position of upstream neighbours.
5. *How do tests avoid PostgreSQL?* `conftest.py` overrides `get_db` with a temporary SQLite session.
