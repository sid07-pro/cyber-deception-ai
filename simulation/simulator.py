"""
simulator.py
Orchestrates the full attacker vs defender simulation and generates
human-readable explanations of each AI decision (for the explainability
panel required in the review).
"""

from simulation.network import build_network, ATTACKER_START, CRITICAL_TARGET
from ai.attacker import run_all_algorithms, select_attacker_path
from ai.defender import plan_defense, evaluate_interception


def run_full_simulation(attacker_strategy="A*", top_n_honeypots=2):
    """
    Runs the entire pipeline:
      1. Build network
      2. Run all search algorithms (for comparison table)
      3. Attacker selects final path using attacker_strategy
      4. Defender scores & selects honeypot locations
      5. Evaluate interception
      6. Generate explanations

    Returns a single dict containing everything the UI needs.
    """
    graph = build_network()

    algo_results = run_all_algorithms(graph, ATTACKER_START, CRITICAL_TARGET)
    attacker_decision = select_attacker_path(graph, ATTACKER_START, CRITICAL_TARGET, attacker_strategy)

    candidate_paths = [res["path"] for res in algo_results.values() if res["path"]]
    honeypot_table, selected_honeypots = plan_defense(graph, candidate_paths, top_n=top_n_honeypots)

    intercepted, hit_node, hit_index = evaluate_interception(
        attacker_decision["path"], selected_honeypots
    )

    explanations = _generate_explanations(
        attacker_decision, selected_honeypots, honeypot_table, intercepted, hit_node
    )

    return {
        "graph": graph,
        "algo_results": algo_results,
        "attacker_decision": attacker_decision,
        "honeypot_table": honeypot_table,
        "selected_honeypots": selected_honeypots,
        "intercepted": intercepted,
        "hit_node": hit_node,
        "hit_index": hit_index,
        "explanations": explanations,
    }


def _generate_explanations(attacker_decision, honeypots, honeypot_table, intercepted, hit_node):
    """Builds dynamic, simulation-specific explanation strings."""
    explanations = []

    strategy = attacker_decision["strategy"]
    path = attacker_decision["path"]
    cost = attacker_decision["cost"]

    if strategy == "A*":
        explanations.append(
            f"The attacker agent used A* search, evaluating f(n) = g(n) + h(n) at each step, "
            f"and selected the path {' → '.join(path)} with total cost {cost}."
        )
    elif strategy == "UCS":
        explanations.append(
            f"The attacker agent used Uniform Cost Search, always expanding the lowest cumulative-cost "
            f"node, and found the minimum-cost path {' → '.join(path)} (cost {cost})."
        )
    else:
        explanations.append(
            f"The attacker agent used {strategy}, producing the path {' → '.join(path)} (cost {cost})."
        )

    if honeypots:
        top = honeypot_table[0]
        explanations.append(
            f"The defender identified {top['node']} as the highest-value deception location, "
            f"scoring {top['deception_score']} based on attack-path frequency "
            f"({top['attack_path_frequency']}), proximity to the critical asset "
            f"({top['target_proximity']}), and node connectivity ({top['node_connectivity']}), "
            f"divided by deployment cost ({top['deployment_cost']})."
        )
        explanations.append(
            f"Honeypots were deployed at {', '.join(honeypots)} — positioned along likely attacker "
            f"routes but never on the critical Database node itself, preserving deception realism."
        )

    if intercepted:
        explanations.append(
            f"During simulation, the attacker's path passed through {hit_node}, which was configured "
            f"as a honeypot. The attacker was deceived before reaching the critical Database."
        )
    else:
        explanations.append(
            "During simulation, the attacker's chosen path did not pass through any deployed "
            "honeypot, so the critical Database was reached. This indicates the defender's "
            "placement should be reconsidered for this attack strategy."
        )

    return explanations
