# Algorithms

All four search functions share one interface: `search(graph, start, goal) -> (path, cost, nodes_explored)`.
- `graph` is an undirected NetworkX graph whose edges carry `weight`.
- An empty path means the goal is unreachable or a node is unknown.

| Algorithm | File | Strategy | Optimal? | Time |
| --- | --- | --- | --- | --- |
| BFS | `ai/bfs.py` | FIFO queue, level by level | Fewest hops, not cost | O(V+E) |
| DFS | `ai/dfs.py` | Explicit stack, deepest first | No | O(V+E) |
| UCS | `ai/ucs.py` | Priority queue on g(n) | Minimum cost | O(E log V) |
| A* | `ai/astar.py` | Priority queue on g(n)+h(n). h is the hop distance × the minimum edge weight, which is admissible | Minimum cost | O(E log V), usually expands fewer nodes |

Limitations:
- Weights are static integers on an undirected graph.
- DFS's result depends on neighbour order.

## Attack-path analysis (`POST /api/simulate`)
- The attacker agent commits to the path from its chosen algorithm. All four run for comparison.
- `alternative_paths` lists the 3 cheapest simple paths (Yen's algorithm via `nx.shortest_simple_paths`), each with its honeypot coverage.
- **This is graph search, not a trained predictor.** The assumption is a cost-minimising attacker with full knowledge of the topology.

## Honeypot placement (`ai/optimizer.py`)

```
score(n) = (attack_path_frequency + 1/(hops_to_target+1) + degree) / deployment_cost
```

- **Attack-path frequency:** how many of the four algorithms' paths contain n.
- **Selection:** the top-k nodes by score are chosen, never the start or the target.
- **Deployment cost:** a fixed simulated table, or `metadata.deployment_cost` for a saved scenario (default 1).
- This is greedy and transparent. Hill Climbing and the Genetic Algorithm (`ai/hill_climbing.py`, `ai/genetic.py`, fitness in `ai/fitness.py`) search the same placement space.

## Adversarial, Bayesian, planning
- Minimax and Alpha-Beta over an attacker-vs-defender game (`ai/deception_game.py`).
- Bayes updates with documented, assumed likelihoods (`ai/bayesian.py`).
- Forward and backward state-space planning (`ai/planning.py`).

Assumptions and limitations for each are in [METHODOLOGY.md](METHODOLOGY.md).
