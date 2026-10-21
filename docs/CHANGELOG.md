# Changelog

## Recovery pass — 2026-10-21 (branch `recovery/cyber-deception-ai`, uncommitted)

### Added
- `POST /api/simulate` accepts `scenario_id`, so simulations can run on a saved topology.
- `alternative_paths` in the simulate response: the 3 cheapest routes, each with its honeypot coverage.
- UI: a **Simulate** button and algorithm picker on Saved Scenarios, plus an alternative-routes table in the result panel.
- Tests:
  - `tests/test_search_edge_cases.py` (31): unreachable targets, cycles, competing routes, unknown nodes, start == goal, random-graph optimality.
  - `tests/test_scenario_simulation.py` (10).
  - 2 new frontend tests.

### Fixed
- The search algorithms no longer raise on unknown start or goal nodes. A* no longer crashes on edgeless graphs.
- Explanations name the actual target, and a no-path run is no longer reported as "target reached".
- The defender no longer places a honeypot on the attacker's start or target node.

### Preserved
- The pre-existing uncommitted deployment work (`render.yaml`, `vercel.json`, CORS/DB URL settings, health DB status).

## Earlier history
See `git log`: Phase 0 → Phase 1 → Milestones 2–5 → Final milestone (`d1d70a0`).
