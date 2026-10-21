# Testing

## Commands

```bash
cd backend && .venv/Scripts/python -m pytest -q
cd frontend && npx tsc -b --noEmit && npx vitest run && npm run build
```

## Verified results (2026-10-21)

| Check | Result |
| --- | --- |
| Backend pytest | **170 passed**: the 129 pre-existing tests (deployment-config tests included) plus 41 new |
| Frontend `tsc --noEmit` | Passed |
| Frontend vitest | **36 passed** (34 pre-existing + 2 new) |
| `npm run build` | Passed |
| Live API checks via curl | Passed for health, network, simulate (incl. 404/422 errors), all 5 `/api/ai/analyze` techniques, planning, experiments |
| Live UI in the browser | Passed for the dashboard, Simulation run (UCS → cost 8, intercepted), and save → simulate → delete of a saved scenario |
| Docker Compose | See `DEPLOYMENT.md` |

## Not covered
- No automated browser end-to-end suite. The UI was checked by hand in a browser.
- Live PostgreSQL is exercised only through Docker; the pytest suite uses SQLite.
