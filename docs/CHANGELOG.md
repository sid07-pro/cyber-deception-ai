# Changelog

## UI redesign — 2026-10-21 (uncommitted)

### Design
- New visual identity: obsidian black with champagne gold.
- Semantic Tailwind tokens (`ink`, `panel`, `raised`, `line`, `gold`, `fg`, `ok`, `warn`, `bad`) in `tailwind.config.js`.
- Shared component classes (`panel`, `field`, `btn-primary`, `data-table`, …) in `src/index.css`.
- Respects `prefers-reduced-motion`.

### Application shell
- Grouped sidebar navigation with icons and a gold active indicator. It collapses to a toggle menu on narrow screens.
- Header with breadcrumb, a "Simulated environment" badge, and an API/DB status pill. The pill polls the real `/api/health` endpoint every 30 s.

### Network graph
- Custom React Flow nodes with a glyph and text tag for each role (entry, target, candidate, decoy, host), so roles never rely on colour alone.
- Straight centre-to-centre weighted links, with the analysed route drawn in gold.
- Barycentre column ordering to reduce edge crossings.
- Clickable selection and a shared legend.

### Pages
- **New Network Topology page:** asset inspector, host table, and buttons to set the start or target.
- **New Honeypot Placement page:** compares the greedy deception score with the Hill Climbing and Genetic Algorithm placements on the same scenario. It shows the candidate score breakdown, route coverage, fitness components, and the assumptions behind each method.
- **Attack Path Analysis** (formerly Simulation) uses a two-panel workspace.
  - The Run button is disabled when start equals target.
- **Dashboard** shows real metrics, this session's latest result and recommendations, and empty states. Simulation history moved up into `App`, so the dashboard can read it.
- Advanced AI, Planning, Experiment Lab, Saved Scenarios, and About/Methodology were renamed where needed and restyled.

### Fixes
- The Methodology page described UCS as "informed"; it is an uninformed search.

### Tests
- 44 frontend tests, up from 36, including new tests for the Topology page, the Placement page, and dashboard history.

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
