"""
bayesian.py
Bayesian reasoning about uncertain attacker behaviour.

Plain probability arithmetic — no ML framework. Every number is derived from
documented assumptions so the reasoning can be explained during review.

Core identity:
    P(H|E) = P(E|H) * P(H) / ( P(E|H) * P(H) + P(E|¬H) * (1 - P(H)) )
"""

from dataclasses import dataclass
from typing import Any

import networkx as nx

from simulation.network import CRITICAL, NODE_ROLES


@dataclass(frozen=True)
class Evidence:
    """One observation, with its likelihood under each hypothesis."""

    name: str
    likelihood_given_hypothesis: float
    likelihood_given_not_hypothesis: float
    observed: bool = True

    def __post_init__(self) -> None:
        for value in (self.likelihood_given_hypothesis, self.likelihood_given_not_hypothesis):
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"Likelihoods must lie in [0, 1]; got {value}.")


def posterior(prior: float, evidence: Evidence) -> float:
    """Single-evidence Bayes update. Returns P(H|E), or P(H|¬E) when unobserved."""
    if not 0.0 <= prior <= 1.0:
        raise ValueError(f"Prior must lie in [0, 1]; got {prior}.")

    if evidence.observed:
        likelihood_h = evidence.likelihood_given_hypothesis
        likelihood_not_h = evidence.likelihood_given_not_hypothesis
    else:
        likelihood_h = 1.0 - evidence.likelihood_given_hypothesis
        likelihood_not_h = 1.0 - evidence.likelihood_given_not_hypothesis

    numerator = likelihood_h * prior
    denominator = numerator + likelihood_not_h * (1.0 - prior)
    if denominator == 0.0:
        return 0.0
    return numerator / denominator


def sequential_posterior(prior: float, evidence: list[Evidence]) -> float:
    """
    Applies each observation in turn.

    Assumption: observations are conditionally independent given the hypothesis,
    which lets posteriors chain as successive priors.
    """
    belief = prior
    for item in evidence:
        belief = posterior(belief, item)
    return belief


# ---- Risk estimation service ----

# Assumed base rate that any given host is on the attacker's route.
BASE_PRIOR = 0.2


def node_prior(graph: nx.Graph, node: str) -> float:
    """
    Prior that a node lies on the attack route, from its structural exposure.

    Assumption: better-connected hosts are likelier stepping stones, scaled
    against the most-connected host in the network.
    """
    degrees = [degree for _, degree in graph.degree()]
    max_degree = max(degrees) if degrees else 1
    exposure = graph.degree(node) / max_degree if max_degree else 0.0
    return round(min(0.95, BASE_PRIOR + 0.5 * exposure), 4)


def node_risk(
    graph: nx.Graph,
    node: str,
    predicted_path: list[str],
    honeypots: list[str],
    target: str,
) -> dict[str, Any]:
    """
    Posterior probability that `node` is compromised on the way to `target`.

    Evidence considered: whether the predicted path crosses the node, whether
    the node is fortified with a honeypot, and whether it is the critical asset.
    """
    prior = node_prior(graph, node)

    evidence = [
        Evidence(
            name="on_predicted_path",
            likelihood_given_hypothesis=0.9,
            likelihood_given_not_hypothesis=0.25,
            observed=node in predicted_path,
        ),
        Evidence(
            name="fortified_with_honeypot",
            likelihood_given_hypothesis=0.15,
            likelihood_given_not_hypothesis=0.6,
            observed=node in honeypots,
        ),
        Evidence(
            name="critical_asset",
            likelihood_given_hypothesis=0.7,
            likelihood_given_not_hypothesis=0.4,
            observed=NODE_ROLES.get(node) == CRITICAL or node == target,
        ),
    ]

    risk = sequential_posterior(prior, evidence)
    return {
        "node": node,
        "prior": prior,
        "posterior": round(risk, 4),
        "evidence": [
            {"name": item.name, "observed": item.observed} for item in evidence
        ],
    }


def path_risk(node_posteriors: list[float]) -> float:
    """
    Probability that at least one node on a route is compromised.

    Assumption: per-node compromise events are independent, so the complement
    rule applies: 1 - Π(1 - p).
    """
    survival = 1.0
    for probability in node_posteriors:
        survival *= 1.0 - probability
    return round(1.0 - survival, 4)
