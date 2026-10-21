# Deployment

## Local (no Docker)

```bash
cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev          # http://localhost:5173, proxies /api to :8000
```

- SQLite (`backend/cyber_deception.db`) is used by default.
- The legacy Streamlit app needs `streamlit`, `plotly` and `pandas`. Run it with `PYTHONPATH=backend streamlit run legacy/app.py`. That command is not verified: those packages are not in the backend venv.

## Docker Compose (verified 2026-10-21)

```bash
cp .env.example .env        # set POSTGRES_PASSWORD
docker compose up -d --build
```

Services:
- `db`: postgres:16-alpine, with a healthcheck and the `postgres-data` volume.
- `backend`: :8000, starts once the db is healthy.
- `frontend`: :5173.

Verified:
- `/api/health` reports `database: connected`.
- A scenario was saved to PostgreSQL, simulated with `scenario_id`, and deleted.
- The frontend answers 200 and proxies `/api`.

**Port conflict:** if host port 5432 is taken (as it was here by another project's container), set `POSTGRES_PORT` to a free port. The backend reaches the db over the internal network, so it is unaffected:

```bash
POSTGRES_PORT=5434 docker compose up -d --build
```

The first build here failed once in `pip install` (a network blip). A plain rebuild succeeded.

Stop with `docker compose down`. Do not add `-v` unless you mean to delete the database volume.

## Cloud (configured, NOT deployed or verified)
- `render.yaml`: the API plus managed PostgreSQL. Set `ALLOWED_ORIGINS` to the Vercel URL.
- `vercel.json`: the frontend build. Set `VITE_API_BASE_URL` to the Render API URL.
