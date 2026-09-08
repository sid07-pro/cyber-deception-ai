# CYBER-DECEPTION AI

**Intelligent Honeypot Placement & Attacker Path Prediction**

## Project Title
AI-Based Cyber Deception System for Intelligent Honeypot Placement and Attacker Path Prediction

## Problem Statement
Traditional network defense is reactive. This project explores whether AI search and optimization
techniques can proactively predict an attacker's most likely path through a network and place
deceptive decoy systems (honeypots) to intercept the attacker before a critical asset is reached.

## Motivation
Cyber deception is a growing area of defensive security research. Rather than only blocking
attacks, deception techniques aim to mislead attackers into wasting effort on decoys, buying
defenders time and generating early warning. This project reframes that problem as a classic
AI planning and search problem, suitable for demonstrating core AI coursework concepts.

## Objectives
- Represent a network as a weighted graph (state space).
- Model an attacker as a goal-based intelligent agent seeking a critical asset.
- Implement uninformed search (BFS, DFS) and informed search (UCS, A*) to predict attacker paths.
- Model a defender as a utility-based agent that optimally places honeypots using a transparent
  scoring function (a local-search/optimization approach).
- Simulate the attacker-defender interaction and determine whether deception succeeds.
- Provide an explainability panel describing *why* each AI decision was made.

## AI Concepts Used
- Intelligent agents (goal-based attacker, utility-based defender)
- State-space representation
- Uninformed search: BFS, DFS
- Informed search: Uniform Cost Search, A* (f(n) = g(n) + h(n))
- Local search / optimization (honeypot deception scoring)
- (Optional/Phase 2) Adversarial search (Minimax), Bayesian reasoning

## System Architecture
```
PERCEPTION → NETWORK STATE → ATTACKER AGENT → SEARCH →
DEFENDER AGENT → HONEYPOT OPTIMIZATION → ATTACK SIMULATION → DECISION
```

## Algorithms
All four search algorithms (BFS, DFS, UCS, A*) are implemented manually (no library search
calls) in `ai/bfs.py`, `ai/dfs.py`, `ai/ucs.py`, `ai/astar.py`, so each step can be explained
during the viva.

A*'s heuristic `h(n)` is the BFS hop-distance from a node to the target, scaled by the graph's
minimum edge weight — this keeps the heuristic admissible (never overestimates true cost).

## Technology Stack
- Python 3
- Streamlit (dashboard UI)
- NetworkX (graph data structure)
- Plotly (interactive network visualization)
- Pandas (tabular displays)

## Installation
```bash
cd cyber-deception-ai
pip install -r requirements.txt
```

## Run Instructions
```bash
streamlit run app.py
```
Then open the local URL Streamlit prints (typically `http://localhost:8501`).

## Demo Scenario
Click **"Run Demo Scenario"** in the sidebar. This automatically:
1. Loads the predefined network.
2. Runs all four search algorithms and compares them.
3. Selects the attacker's path (default strategy: A*).
4. Computes defender honeypot placement.
5. Runs the attack simulation and shows the final result.

The entire flow — network → attack path → AI search → honeypot placement → attack → deception
outcome — can be demonstrated in under two minutes.

## Testing
Run `python test_algorithms.py` to verify:
- All algorithms return valid, connected paths from attacker start to target.
- UCS returns the true minimum-cost path (verified by brute-force comparison).
- A* matches UCS's optimal cost.
- The full simulation pipeline runs end-to-end without errors.

## Important Note
This is an **educational, fully simulated system**. All network nodes, attackers, and events are
fictional. No real hacking, exploitation, scanning, or offensive cybersecurity functionality is
implemented anywhere in this codebase.

## Future Scope
- Adversarial search (Minimax) between attacker and defender.
- Bayesian reasoning module for probabilistic threat estimation.
- Larger, randomly generated network topologies.
- Reinforcement-learning-based adaptive defender.
- Multi-attacker / multi-honeypot scenarios.
