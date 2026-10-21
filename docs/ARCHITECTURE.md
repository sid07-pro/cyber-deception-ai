# Architecture

```
React 18 + TS + Vite + Tailwind + React Flow  (frontend/src)
        │  fetch /api/*  (the Vite dev proxy in dev; VITE_API_BASE_URL in prod)
        ▼
FastAPI routes (app/api/routes) → Pydantic schemas (app/schemas)
        ▼
Services (app/services): thin adapters, no HTTP
        ▼
Algorithms (ai/, simulation/): pure Python + NetworkX, no HTTP or ORM
        ▼
SQLAlchemy (app/models, app/db) → SQLite by default, or PostgreSQL 16 (Docker/managed)
```

## Data flow for a simulation

1. The UI posts to `/api/simulate`.
2. The route loads the saved scenario, if a `scenario_id` was given.
3. `simulation_service.run_simulation` builds the graph and runs all four searches. The attacker commits to the chosen algorithm's path.
4. The optimizer scores candidates, then interception is checked and explanations are written.
5. The response is rendered by `ResultPanel`.

## State
- Stepped sessions and unsaved experiments live **in memory**.
- Scenarios and saved experiments live in the database. Tables are created at startup with `create_all`; there are no migrations.

## Exposed services

| Service | Port | Purpose |
| --- | --- | --- |
| Frontend | 5173 | Vite dev server |
| Backend | 8000 | API |
| PostgreSQL | `POSTGRES_PORT` (5432 by default) | Docker only; published for local inspection |

## Security notes
- Everything is simulated. There is no scanning, no networking to targets, and no command execution.
- CORS is restricted to configured origins and never `*`.
- No secrets ship in the frontend bundle.
