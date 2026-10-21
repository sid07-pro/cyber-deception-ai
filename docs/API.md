# API

The base path is `/api`. Interactive OpenAPI docs are at `http://localhost:8000/docs`; they are generated from the Pydantic schemas in `backend/app/schemas/` and are authoritative. The README has the full endpoint table.

## Errors

All errors return `{"detail": ...}`:

| Status | Meaning |
| --- | --- |
| 404 | Unknown node, scenario, or experiment |
| 409 | Duplicate scenario name |
| 422 | Validation failure |
| 503 | Database unavailable (persistence endpoints only) |

## `POST /api/simulate`

Request (all fields are optional):

```json
{"algorithm": "A*", "start_node": "Internet", "target_node": "Database", "honeypot_count": 2, "scenario_id": null}
```

| Field | Rule |
| --- | --- |
| `algorithm` | One of `BFS`, `DFS`, `UCS`, `A*` |
| `honeypot_count` | 0–5 |
| `scenario_id` | ≥ 1; runs on a saved scenario |

Response fields:

| Field | Contents |
| --- | --- |
| `path`, `path_cost`, `nodes_explored` | The attacker's chosen route and what the search cost |
| `honeypots`, `honeypot_scores[]` | The placement and its full score breakdown |
| `result` | `intercepted`, `target_reached`, or `no_path` |
| `intercepted_at`, `intercepted_at_step` | Where the attacker was caught |
| `algorithm_comparison[]` | All four algorithms run on the same scenario |
| `alternative_paths[]` | `{rank, path, cost, hops, honeypots_on_path, intercepted}` |
| `scenario_id` | The saved scenario used, or null |
| `explanation[]` | Human-readable account of each decision |

## `GET /api/health`

```json
{"status": "ok", "service": "cyber-deception-ai", "version": "0.1.0", "environment": "development", "database": "connected"}
```

It always returns 200. Check `database` (`connected` / `unavailable`) to tell whether the database is up.
