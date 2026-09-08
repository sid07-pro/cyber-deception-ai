# Review 1 — Presentation Content

## 1. Title
**AI-Based Cyber Deception System for Intelligent Honeypot Placement and Attacker Path Prediction**

## 2. Problem Statement
Conventional network defenses are largely reactive, responding only after an intrusion is
detected. This project investigates whether AI search and optimization techniques can be used
proactively — to predict the paths an attacker is most likely to take through a network, and to
strategically place deceptive decoy systems (honeypots) that intercept the attacker before a
critical asset is compromised.

## 3. Motivation
Cyber deception is an active area of defensive security research, based on the idea that
misleading an attacker (rather than only blocking them) can waste their resources, delay their
progress, and generate high-confidence early-warning signals. This makes it a natural
application domain for classical and heuristic AI search, intelligent agent design, and
optimization — all core topics in the Artificial Intelligence syllabus.

## 4. Objectives
1. Represent a computer network as a weighted graph (a state-space).
2. Model an attacker as a goal-based intelligent agent trying to reach a critical asset.
3. Implement and compare uninformed search (BFS, DFS) and informed search (UCS, A*) for
   predicting attacker paths.
4. Model a defender as a utility-based agent that selects honeypot locations using a
   transparent, explainable scoring function.
5. Simulate the attacker-defender interaction and determine the outcome (deception success
   or failure).
6. Provide a human-readable explanation of every AI decision made during the simulation.

## 5. Proposed Solution
A simulated network of 8 nodes (Internet, Web Server, Application Server, Employee PC, Admin
PC, File Server, Database, and dynamically-placed Honeypots) is represented as a weighted graph
using NetworkX. An attacker agent begins at "Internet" and must reach the critical "Database"
node. Four search algorithms — BFS, DFS, UCS, and A* — are run and compared on path, cost, and
nodes explored. The attacker's final path is chosen using its configured search strategy
(A* by default). A defender agent then scores every non-critical node using a Deception Score
(combining attack-path frequency, proximity to the target, and node connectivity, divided by
deployment cost) and deploys honeypots at the top-scoring node(s). The simulation then checks
whether the attacker's path intersects a honeypot before reaching the Database, and reports
whether the deception succeeded.

## 6. AI Techniques Used
- **Intelligent Agents**: goal-based attacker agent, utility-based defender agent.
- **State-Space Search**: the network graph as the state space; nodes as states, edges as
  actions with associated costs.
- **Uninformed Search**: Breadth First Search, Depth First Search.
- **Informed Search**: Uniform Cost Search, A* Search (f(n) = g(n) + h(n)) with an admissible
  heuristic derived from hop-distance scaled by minimum edge weight.
- **Local Search / Optimization**: greedy scoring-based honeypot placement.
- **(Planned, Phase 2) Adversarial Search**: Minimax modeling attacker-maximizing vs.
  defender-minimizing success probability.
- **(Planned, Phase 2) Bayesian Reasoning**: probabilistic estimation of malicious activity
  from simulated observations.

## 7. System Architecture
```
PERCEPTION → NETWORK STATE → ATTACKER AGENT → SEARCH →
DEFENDER AGENT → HONEYPOT OPTIMIZATION → ATTACK SIMULATION → DECISION
```
Each stage is implemented as a distinct, testable module (`simulation/network.py`,
`ai/attacker.py`, `ai/bfs.py`/`dfs.py`/`ucs.py`/`astar.py`, `ai/defender.py`,
`ai/optimizer.py`, `simulation/simulator.py`).

## 8. Methodology
1. **Graph Construction**: Build the fixed, deterministic simulated network with weighted edges.
2. **Search Execution**: Run BFS, DFS, UCS, and A* from the attacker's start node to the
   critical target, recording path, total cost, and nodes explored for each.
3. **Attacker Decision**: The attacker agent selects its actual path using a configurable
   strategy (default: A*, representing an "intelligent" attacker).
4. **Defender Optimization**: For every eligible node, compute a Deception Score from three
   positive factors (attack-path frequency across all four algorithms' outputs, proximity to
   the target, node connectivity) divided by a simulated deployment cost; select the top-N
   nodes as honeypots.
5. **Simulation**: Step the attacker along its chosen path; at each step check whether the
   current node is a deployed honeypot.
6. **Explanation Generation**: Dynamically construct natural-language explanations referencing
   the actual computed values (not hard-coded text).

## 9. Expected Results
- BFS returns the fewest-hop path but not necessarily the lowest-cost path.
- UCS and A* return the same, truly minimum-cost path; A* typically explores fewer nodes than
  UCS due to its heuristic guidance.
- The defender reliably identifies nodes that lie on multiple algorithms' predicted attacker
  paths as high-value honeypot locations.
- In the default demo network, the defender's chosen honeypot placement successfully
  intercepts the attacker's A*-selected path, demonstrating a working deception scenario.

## 10. Future Scope
- Add Minimax-based adversarial search modeling repeated attacker-defender move exchanges.
- Add a Bayesian reasoning module to probabilistically estimate malicious intent from
  simulated observation signals (clearly labeled as an educational, non-production model).
- Support larger and randomly generated network topologies for stress-testing the approach.
- Explore reinforcement learning for an adaptive defender that improves placement over
  repeated simulated engagements.
- Extend to multi-attacker and multi-honeypot scenarios with resource constraints.

---
*This is an educational simulation intended to demonstrate AI concepts (intelligent agents,
state-space search, informed search, optimization, and adversarial decision-making). It is not
a production cybersecurity system and does not implement any real hacking, exploitation, or
offensive capability.*
