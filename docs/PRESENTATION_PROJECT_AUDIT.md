# Presentation Project Audit

**Audit date:** 2026-10-21.

**Repository:** `D:\cyber-deception-ai`. The branch is `recovery/cyber-deception-ai`, which tracks `origin/main` at https://github.com/sid07-pro/cyber-deception-ai.

**What this is based on:** source code, the automated tests, and the running application. The application was run both locally and as the Docker Compose stack.

Every number quoted in the deliverables comes from a run of this code. They were collected with a fact-collection script that calls the real services, and with screenshots of the running UI.

## 1. What the project is

A **simulation-only** cyber deception platform.

- A fictional 7-host network is modelled as a weighted, undirected graph.
- An *attacker agent* uses graph search to find a route from `Internet` to the critical `Database`.
- A *defender agent* scores candidate hosts and places honeypots (decoys) on the most valuable ones.
- The system then checks whether the attacker's route walks into a honeypot before reaching the asset.

There are no real hosts, IP addresses, scanning, exploits, or telemetry.

## 2. Architecture (verified)

| Layer | Technology | Location |
| --- | --- | --- |
| UI | React 18, TypeScript 5, Vite 5, Tailwind 3, React Flow 11 | `frontend/src` |
| API | FastAPI with Pydantic v2 schemas | `backend/app/api/routes`, `backend/app/schemas` |
| Services | Plain Python adapters | `backend/app/services` |
| Algorithms | Pure Python and NetworkX | `backend/ai`, `backend/simulation` |
| Persistence | SQLAlchemy 2 (SQLite by default, PostgreSQL 16 in Docker) | `backend/app/models`, `backend/app/db` |
| Runtime | Docker Compose with three services: `db`, `backend`, `frontend` | `docker-compose.yml` |
| Legacy prototype | Streamlit | `legacy/app.py` (preserved; not part of the running stack) |

## 3. Feature inventory

### Implemented and verified (tests plus a live run)

| Feature | Evidence |
| --- | --- |
| Network graph: 7 nodes, 9 weighted edges | `simulation/network.py`; `GET /api/network`; dashboard screenshot |
| BFS, DFS, UCS, A* (hand-written, not NetworkX calls) | `ai/bfs.py`, `ai/dfs.py`, `ai/ucs.py`, `ai/astar.py`; `tests/test_search.py`, `tests/test_search_edge_cases.py` |
| Attacker agent: runs all four searches, commits to one | `ai/attacker.py` |
| Greedy honeypot scoring (deception score) | `ai/optimizer.py`; results table in screenshot 03 |
| Interception check | `ai/defender.py: evaluate_interception` |
| Natural-language explanations | `simulation/simulator.py: _generate_explanations` |
| `POST /api/simulate`, including `scenario_id` and the 3 cheapest alternative routes | `app/services/simulation_service.py`; `tests/test_simulation_api.py`, `tests/test_scenario_simulation.py` |
| Stepped simulation (start / step / reset), held in memory | `app/services/deception_engine.py`; `tests/test_session_api.py` |
| Minimax and Alpha-Beta on an attacker-vs-defender game | `ai/minimax.py`, `ai/alpha_beta.py`, `ai/deception_game.py`; `tests/test_advanced_ai.py` |
| Bayesian risk (sequential Bayes updates with assumed likelihoods) | `ai/bayesian.py` |
| Hill Climbing (steepest ascent with random restarts) and a Genetic Algorithm | `ai/hill_climbing.py`, `ai/genetic.py`, `ai/fitness.py` |
| STRIPS-style forward and backward planning | `ai/planning.py`; `tests/test_planning.py` |
| Experiment lab: repeated runs and comparison of five placement strategies | `app/services/experiment_service.py`; `tests/test_experiments.py`; screenshot 05 |
| Saved scenarios and experiment history (database) | `app/services/persistence_service.py`; `tests/test_persistence.py` |
| JSON and CSV export of experiments | `frontend/src/lib/export.ts` |
| Docker Compose stack (PostgreSQL connected) | Verified live on 2026-10-21 |

### Implemented but not verified

- The Render/Vercel cloud configuration (`render.yaml`, `vercel.json`). It has **not** been deployed.
- The legacy Streamlit app. It needs `PYTHONPATH=backend` plus `streamlit`, `plotly` and `pandas`, and was not run.

### Partially implemented

- **Custom topologies.** They can be created only through `POST /api/scenarios`. There is no editor in the UI.
- **Saved scenarios reach `/api/simulate` only.** The stepped simulation, AI analysis, planning and experiments always use the built-in network.

### Planned, not implemented

- A learned or trained attacker-prediction model. **There is no machine learning in this project.**
- Real telemetry, live network integration, or real honeypot deployment.
- Directed edges, vulnerability or CVE data, and exploit-probability edges.

### Broken or unavailable

- Nothing found. The test suites pass: 170 backend tests and 44 frontend tests (after the UI redesign) on 2026-10-21.

## 4. Real outputs used in the slides (built-in network, Internet → Database)

### Search algorithms

| Algorithm | Path | Cost | Nodes explored |
| --- | --- | --- | --- |
| BFS | Internet → Web Server → Application Server → Database | 8 | 5 |
| DFS | same | 8 | 4 |
| UCS | same | 8 | 7 |
| A* | same | 8 | 7 |

A* explores as many nodes as UCS here. Its heuristic (hop distance × minimum edge weight 1) is weak on this graph.

### Greedy honeypot scores (A*, 2 honeypots)

| Node | Path freq | Proximity | Degree | Cost | Score |
| --- | --- | --- | --- | --- | --- |
| Web Server | 4 | 0.333 | 3 | 2 | **3.667** (selected) |
| Employee PC | 0 | 0.333 | 3 | 1 | **3.333** (selected) |
| Application Server | 4 | 0.5 | 3 | 3 | 2.5 |
| File Server | 0 | 0.5 | 3 | 2 | 1.75 |
| Admin PC | 0 | 0.5 | 2 | 2 | 1.25 |

Outcome: the attacker is intercepted at Web Server, step 1.

### Alternative routes (cheapest first)

1. Internet → Web Server → Application Server → Database: cost 8
2. Internet → Web Server → Employee PC → Admin PC → Database: cost 9
3. Internet → Web Server → Application Server → File Server → Database: cost 10

### Advanced AI techniques

- **Minimax and Alpha-Beta** (depth 4): both recommend "move Web Server" with value 2.6667. Minimax visits 69 states; Alpha-Beta visits 35 and prunes 14 branches.
- **Bayesian:** Database posterior 0.969 and route risk 0.9999. These rest on **assumed** likelihoods.
- **Hill Climbing:** {Application Server, Employee PC}, fitness 6.2667, 44 evaluations.
- **Genetic Algorithm:** {File Server, Web Server}, fitness 6.2667, 194 evaluations.

### Planning

Forward and backward search find the same 3-action plan, at cost 7:

1. Place a honeypot on Application Server.
2. Place a honeypot on File Server.
3. Block the Admin PC–Database link.

Forward search explores 48 states; backward search explores 5.

### Experiment (A*, budget 1, 20 runs, seed 0), interception rate by strategy

| Strategy | Interception rate |
| --- | --- |
| None | 0% |
| Random | 50% |
| Greedy | 100% |
| Hill Climbing | 100% |
| Genetic Algorithm | 100% |

## 5. Caveats you must state

- **The 100% interception result is a property of this topology.** `Internet` has a single neighbour, `Web Server`, so every route passes through Web Server. It acts as a chokepoint. Any strategy that picks Web Server wins. This is **not** evidence that the method generalises.
- **The attacker is deterministic.** It always takes its algorithm's path. Only the random placement strategy varies between runs.
- **Timings in ms are machine-dependent** and are reported only as indications.
- **All weights, costs, priors and likelihoods are hand-chosen modelling assumptions,** not measurements.

## 6. Screenshots

These are real captures of the redesigned UI. They were taken on 2026-10-21 with headless Chrome at 2× scale, against the local Vite dev server and the Docker backend with PostgreSQL. The files are in `deliverables/screenshots/`:

1. `01_dashboard_empty.jpg`
2. `02_attack_path_workspace.jpg`
3. `03_attack_path_results.jpg`
4. `04_dashboard_after_run.jpg`
5. `05_network_topology_inspector.jpg`
6. `06_honeypot_placement.jpg`
7. `07_honeypot_method_comparison.jpg`
8. `08_advanced_alpha_beta.jpg`
9. `09_defense_planning.jpg`
10. `10_experiment_lab.jpg`
11. `11_methodology.jpg`

## 7. Test status at audit time

- **Backend:** 170 pytest tests passed.
- **Frontend:** 44 Vitest tests passed, `tsc --noEmit` reported 0 errors, and `npm run build` succeeded.
