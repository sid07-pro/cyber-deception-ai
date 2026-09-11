"""
test_advanced_ai.py
Covers the advanced AI modules: adversarial search, Bayesian risk, and the
honeypot placement optimizers.
"""

import pytest

from ai import genetic, hill_climbing
from ai.alpha_beta import alpha_beta
from ai.bayesian import Evidence, node_risk, path_risk, posterior, sequential_posterior
from ai.deception_game import DeceptionGame
from ai.fitness import evaluate
from ai.minimax import minimax
from simulation.network import ATTACKER_START, CRITICAL_TARGET, build_network


# ---- A small deterministic game tree with a known optimum ----


class ToyGame:
    """
    Depth-2 tree. MAX picks L or R; MIN then picks from the leaves below.

        L -> min(3, 12, 8) = 3
        R -> min(2, 4, 6)  = 2

    MAX should therefore choose 'L' with value 3.
    """

    TREE = {"L": [3, 12, 8], "R": [2, 4, 6]}

    def actions(self, state):
        if state == "root":
            return ["L", "R"]
        if state in self.TREE:
            return list(range(len(self.TREE[state])))
        return []

    def result(self, state, action):
        return action if state == "root" else self.TREE[state][action]

    def is_terminal(self, state):
        return isinstance(state, int)

    def utility(self, state):
        return float(state) if isinstance(state, int) else 0.0

    def is_max(self, state):
        return state == "root"


def test_minimax_selects_the_optimal_branch_of_a_known_tree():
    action, value, stats = minimax(ToyGame(), "root", depth=3)

    assert action == "L"
    assert value == 3.0
    assert stats.nodes_visited == 9  # root + 2 inner + 6 leaves


def test_alpha_beta_matches_minimax_and_visits_no_more_nodes():
    game = ToyGame()
    mm_action, mm_value, mm_stats = minimax(game, "root", depth=3)
    ab_action, ab_value, ab_stats = alpha_beta(game, "root", depth=3)

    assert (ab_action, ab_value) == (mm_action, mm_value)
    assert ab_stats.nodes_visited <= mm_stats.nodes_visited
    assert ab_stats.branches_pruned > 0


@pytest.mark.parametrize("depth", [2, 3, 4])
def test_alpha_beta_matches_minimax_on_the_deception_game(depth):
    graph = build_network()
    game = DeceptionGame(graph, ATTACKER_START, CRITICAL_TARGET)
    state = game.initial_state(honeypot_budget=2)

    mm_action, mm_value, mm_stats = minimax(game, state, depth)
    ab_action, ab_value, ab_stats = alpha_beta(game, state, depth)

    assert ab_action == mm_action
    assert ab_value == pytest.approx(mm_value)
    assert ab_stats.nodes_visited <= mm_stats.nodes_visited


def test_deception_game_never_offers_start_or_target_as_honeypots():
    graph = build_network()
    game = DeceptionGame(graph, ATTACKER_START, CRITICAL_TARGET)
    state = game.initial_state(honeypot_budget=3)

    eligible = game.eligible_honeypots(state)
    assert ATTACKER_START not in eligible
    assert CRITICAL_TARGET not in eligible


# ---- Bayesian reasoning ----


def test_posterior_matches_the_hand_calculated_value():
    # P(H)=0.2, P(E|H)=0.9, P(E|~H)=0.3 -> 0.18 / (0.18 + 0.24) = 0.428571...
    evidence = Evidence("sensor", 0.9, 0.3)
    assert posterior(0.2, evidence) == pytest.approx(0.18 / 0.42)


def test_unobserved_evidence_uses_the_complement_likelihoods():
    evidence = Evidence("sensor", 0.9, 0.3, observed=False)
    # 0.1*0.2 / (0.1*0.2 + 0.7*0.8) = 0.02 / 0.58
    assert posterior(0.2, evidence) == pytest.approx(0.02 / 0.58)


def test_sequential_posterior_chains_updates():
    first = Evidence("a", 0.8, 0.2)
    second = Evidence("b", 0.6, 0.3)
    chained = sequential_posterior(0.3, [first, second])

    assert chained == pytest.approx(posterior(posterior(0.3, first), second))
    assert 0.0 <= chained <= 1.0


def test_posterior_rejects_out_of_range_prior():
    with pytest.raises(ValueError):
        posterior(1.5, Evidence("a", 0.5, 0.5))


def test_path_risk_uses_the_complement_rule():
    assert path_risk([0.5, 0.5]) == pytest.approx(0.75)
    assert path_risk([]) == pytest.approx(0.0)


def test_node_risk_rises_on_the_predicted_path():
    graph = build_network()
    on_path = node_risk(graph, "Web Server", ["Internet", "Web Server"], [], CRITICAL_TARGET)
    off_path = node_risk(graph, "Web Server", ["Internet"], [], CRITICAL_TARGET)

    assert on_path["posterior"] > off_path["posterior"]
    assert 0.0 <= on_path["posterior"] <= 1.0


# ---- Placement optimizers ----

OPTIMIZERS = [hill_climbing, genetic]


@pytest.fixture
def scenario():
    graph = build_network()
    paths = [
        ["Internet", "Web Server", "Application Server", "Database"],
        ["Internet", "Web Server", "Employee PC", "File Server", "Database"],
    ]
    return graph, paths


@pytest.mark.parametrize("module", OPTIMIZERS)
def test_optimizer_returns_a_valid_placement(module, scenario):
    graph, paths = scenario
    result = module.optimize_placement(
        graph, paths, ATTACKER_START, CRITICAL_TARGET, budget=2, seed=7
    )

    assert len(result["honeypots"]) == 2
    assert set(result["honeypots"]) <= set(graph.nodes)
    assert len(set(result["honeypots"])) == 2
    assert result["fitness"] > 0
    assert result["components"]["coverage"] > 0


@pytest.mark.parametrize("module", OPTIMIZERS)
def test_optimizer_never_selects_start_or_target(module, scenario):
    graph, paths = scenario
    for budget in (1, 2, 3, 5):
        result = module.optimize_placement(
            graph, paths, ATTACKER_START, CRITICAL_TARGET, budget=budget, seed=3
        )
        assert ATTACKER_START not in result["honeypots"]
        assert CRITICAL_TARGET not in result["honeypots"]
        assert len(result["honeypots"]) <= budget


@pytest.mark.parametrize("module", OPTIMIZERS)
def test_optimizer_handles_zero_budget(module, scenario):
    graph, paths = scenario
    result = module.optimize_placement(
        graph, paths, ATTACKER_START, CRITICAL_TARGET, budget=0, seed=1
    )

    assert result["honeypots"] == []
    assert result["fitness"] == 0.0


@pytest.mark.parametrize("module", OPTIMIZERS)
def test_optimizer_is_deterministic_for_a_given_seed(module, scenario):
    graph, paths = scenario
    first = module.optimize_placement(graph, paths, ATTACKER_START, CRITICAL_TARGET, 2, seed=11)
    second = module.optimize_placement(graph, paths, ATTACKER_START, CRITICAL_TARGET, 2, seed=11)

    assert first["honeypots"] == second["honeypots"]
    assert first["fitness"] == second["fitness"]


@pytest.mark.parametrize("module", OPTIMIZERS)
def test_optimizer_handles_a_tiny_network(module):
    import networkx as nx

    graph = nx.Graph()
    graph.add_edge("A", "B", weight=1)
    graph.add_edge("B", "C", weight=1)

    result = module.optimize_placement(graph, [["A", "B", "C"]], "A", "C", budget=2, seed=5)

    # 'B' is the only host that is neither the entry point nor the asset.
    assert result["honeypots"] == ["B"]


def test_fitness_of_an_empty_placement_is_zero():
    graph = build_network()
    assert evaluate(graph, frozenset(), [], CRITICAL_TARGET)["fitness"] == 0.0
