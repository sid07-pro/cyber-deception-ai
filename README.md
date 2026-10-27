# Cyber Deception AI

**Intelligent Honeypot Placement & Attacker Path Prediction**

An AI coursework project that treats network defence as a search, game, and planning problem:
an attacker agent predicts its route to a critical asset, a defender agent spends a honeypot
budget to intercept it, and the whole interaction is simulated, explained, and measured.

> **Simulation only.** Everything here is synthetic. There are no real hosts, addresses,
> credentials, exploits, or offensive capabilities anywhere in this project — the "attacker" is a
> search algorithm walking a weighted graph. See [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

---

## Live deployment (free tier)

| Component | URL |
| --- | --- |
| Web app (GitHub Pages) | https://sid07-pro.github.io/cyber-deception-ai/ |
| API (Render, free web service) | https://cyber-deception-api.onrender.com/api/health |
| Database | Render free PostgreSQL (internal) |

The free API sleeps after ~15 min idle; the first request can take up to a minute. The frontend is
rebuilt and published by `.github/workflows/pages.yml` on every push to `main`.

Final report: [reports/Cyber_Deception_AI_Final_VIT_Report.pdf](reports/Cyber_Deception_AI_Final_VIT_Report.pdf)

## Architecture

```
React + TypeScript + Vite  ──HTTP──►  FastAPI  ──►  ai/ + simulation/  (pure Python)
   React Flow visualization              │
                                         └──►  SQLAlchemy  ──►  PostgreSQL (saved scenarios,
                                                                 experiment history)
```

| Layer | Location | Responsibility |
| --- | --- | --- |
| Algorithms | `backend/ai/`, `backend/simulation/` | Search, agents, game search, Bayesian risk, optimizers, planning. No HTTP, no ORM. |
| Services | `backend/app/services/` | Adapters that compose the algorithms and return plain data. |
| Schemas | `backend/app/schemas/` | Pydantic request/response contracts. |
| Routes | `backend/app/api/routes/` | HTTP only: validation, status codes, error mapping. |
| Models | `backend/app/models/` | SQLAlchemy ORM entities. |
| Frontend | `frontend/src/` | Pages, components, typed API client. |
| Legacy | `legacy/app.py` | The original Streamlit prototype, preserved for reference. Not part of the running stack. |

---

## Prerequisites

- Python 3.12+
- Node.js 20+
- Docker Desktop (optional — only for the containerised stack and PostgreSQL)

---

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API is then at `http://localhost:8000`, with interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend, so no CORS setup is needed
during development.

---

## Database

Persistence is **optional**. Without a database every simulation, AI, planning, and experiment
endpoint still works; only the persistence endpoints answer `503`.

- **Default (no setup):** SQLite at `backend/cyber_deception.db` —
  `DATABASE_URL=sqlite:///./cyber_deception.db`
- **PostgreSQL:**
  `DATABASE_URL=postgresql+psycopg://cda:<password>@localhost:5432/cyber_deception`

Tables are created automatically at startup via `metadata.create_all`. The schema is small and
additive, so no migration tool is used; Alembic can be layered on later without model changes.

---

## Docker

```bash
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose up --build
```

Starts three services: `db` (PostgreSQL 16 with a persistent volume and a `pg_isready`
healthcheck), `backend` (waits for the database to be healthy), and `frontend`. No secrets are
hardcoded — the compose file reads them from `.env`, which is gitignored.

```bash
docker compose config        # validate without starting anything
docker compose down          # stop
docker compose down -v       # stop and delete the database volume
```

---

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness. |
| GET | `/api/network` | The simulated topology. |
| POST | `/api/simulate` | One-shot simulation with a chosen search algorithm; optional `scenario_id` runs it on a saved topology, and the response includes the 3 cheapest alternative routes. |
| POST | `/api/simulation/start` | Begin a stepped session (in memory). |
| POST | `/api/simulation/step` | Advance the attacker one hop. |
| POST | `/api/simulation/reset` | Rewind a session to step 0. |
| POST | `/api/ai/analyze` | Minimax, Alpha-Beta, Bayesian, Hill Climbing, Genetic Algorithm. |
| POST | `/api/planning/plan` | Forward or backward defensive plan. |
| POST | `/api/experiments/run` | Repeated runs with strategy comparison. |
| GET | `/api/experiments/{id}` | Retrieve an in-memory experiment. |
| POST | `/api/scenarios` | Save a network scenario. |
| POST | `/api/scenarios/save-current` | Save the built-in network under a name. |
| GET | `/api/scenarios` | List saved scenarios. |
| GET | `/api/scenarios/{id}` | Retrieve one scenario. |
| DELETE | `/api/scenarios/{id}` | Delete a scenario and its experiments. |
| POST | `/api/experiments/save` | Persist a completed experiment. |
| GET | `/api/experiments-history` | List persisted experiments. |
| GET | `/api/experiments-history/{id}` | Retrieve one persisted experiment. |

---

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest -q
cd frontend && npx tsc -b --noEmit && npx vitest run && npm run build
```

Backend tests use a temporary SQLite database, so none of them require a running PostgreSQL
server.

---

## Project structure

```
backend/
  ai/            search, agents, game search, Bayesian, optimizers, planning
  simulation/    network model and the original simulation pipeline
  app/
    api/routes/  HTTP endpoints
    schemas/     Pydantic contracts
    services/    adapters over the algorithms
    models/      SQLAlchemy entities
    db/          engine and session management
  tests/         pytest suite
frontend/
  src/
    api/         typed client and shared types
    components/  graph, controls, panels
    pages/       dashboard, scenarios, about
    lib/         JSON/CSV export helpers
docs/            methodology and AI technique notes
legacy/          the original Streamlit prototype (reference only)
```

---

## Documentation

- [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — AI techniques, simulation workflow, metrics,
  limitations, and future improvements.
- [REVIEW_1_CONTENT.md](REVIEW_1_CONTENT.md) — Review 1 presentation material.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ALGORITHMS.md](docs/ALGORITHMS.md),
  [docs/API.md](docs/API.md), [docs/TESTING.md](docs/TESTING.md),
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/CHANGELOG.md](docs/CHANGELOG.md)
- [docs/RECOVERY_REPORT.md](docs/RECOVERY_REPORT.md) — 2026-10-21 audit and recovery record.
