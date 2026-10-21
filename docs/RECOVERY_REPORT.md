# Recovery Report — 2026-10-21

## Starting state

- Branch `master` @ `d1d70a0` ("Final milestone: persistence, Docker, testing, and production polish").
- The project was **far past "Phase 0"**. The git history shows Phase 0 → Phase 1 → Milestones 2–5 → Final milestone, all committed.
- Uncommitted work existed: deployment prep (Render/Vercel). It changed `config.py` (CORS/`DATABASE_URL` normalisation), `health.py` (adds a DB status), `client.ts` (a production API-URL guard) and the Dockerfile, and added the untracked files `render.yaml`, `vercel.json` and `tests/test_deployment_config.py`. **It was preserved untouched.**
- Nothing was missing. No deleted files needed recovery from history. `legacy/app.py` is intact.

## Checkpoint

- Created branch `recovery/cyber-deception-ai` from `d1d70a0`. The working tree came along unchanged, and nothing was committed.
- Backup of the pre-recovery diff and untracked files: `pre-recovery-uncommitted.patch` / `pre-recovery-untracked.tar` in the session scratchpad.
- `.env`, `backend/cyber_deception.db` and the Docker volumes were not modified.

## Feature audit (verified by running it)

| Area | Location | State |
| --- | --- | --- |
| 4 search algorithms (BFS, DFS, UCS, A*) | `backend/ai/{bfs,dfs,ucs,astar}.py` | Original. Works. Hardened in this pass (see below). |
| Topology (7 nodes, 9 weighted edges) | `backend/simulation/network.py` | Works. `GET /api/network` |
| Attack path + honeypot scoring | `ai/attacker.py`, `ai/optimizer.py`, `ai/defender.py` | Works. `POST /api/simulate` |
| Stepped agent sessions | `app/services/deception_engine.py` | Works |
| Minimax, Alpha-Beta, Bayesian, Hill Climbing, GA | `backend/ai/*` | Works. `POST /api/ai/analyze` |
| Forward/backward planning | `ai/planning.py` | Works |
| Experiment lab | `services/experiment_service.py` | Works |
| Persistence (SQLite default / PostgreSQL) | `app/models`, `persistence_service.py` | Works |
| React UI (Dashboard, Simulation, Advanced AI, Planning, Experiment Lab, Saved Scenarios, About) | `frontend/src` | Works against the live backend |
| Legacy Streamlit | `legacy/app.py` | Preserved. Its imports resolve only with `PYTHONPATH=backend` (the modules moved in Phase 0). |

## Gaps found and fixed

1. **Search functions crashed on bad input.** A start or goal node that is not in the graph raised `NetworkXError`. A* on a graph with no edges raised `ValueError`. All four now return `([], 0, 0)` for unknown nodes, and A* uses `h = 0` when there are no edges. The search logic itself is unchanged.
2. **Wrong explanations.**
   - The explanation text always said "Database", even when another target was chosen.
   - A run with no path claimed that the target "was reached".
   - Both are now correct.
3. **Saved scenarios could not be simulated.** `POST /api/simulate` now accepts `scenario_id`. It rebuilds the graph from the saved nodes and edges, and per-node `deployment_cost` metadata is honoured. Each saved scenario in the UI now has a **Simulate** button.
4. **No alternative routes.** `/api/simulate` now returns `alternative_paths`: the 3 cheapest loop-free routes (Yen's algorithm via NetworkX), each with its cost and the honeypots that cover it. The UI labels them as graph enumeration, not a learned prediction.
5. **Honeypot candidates included the entry point.** The defender no longer places a honeypot on the chosen start or target node.

## Honest labelling

"Attack-path prediction" is deterministic graph search, not a trained model. The Bayesian priors are documented assumptions, not measurements (see `docs/METHODOLOGY.md`). All data is synthetic.

## Remaining

- Cloud deployment (Render/Vercel config exists) has **not** been deployed or verified.
- There is no topology editor in the UI. Custom topologies can only be created via `POST /api/scenarios`.
- The uncommitted deployment work and this recovery work are still uncommitted, on branch `recovery/cyber-deception-ai`.
