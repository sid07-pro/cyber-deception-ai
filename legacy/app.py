"""
app.py
CYBER-DECEPTION AI — Streamlit dashboard.

An AI-based simulated cyber deception environment for studying
intelligent attacker-defender decision making. Fully simulated /
fictional network — no real hosts, exploitation, or offensive
cybersecurity functionality is implemented.
"""

import streamlit as st
import networkx as nx
import plotly.graph_objects as go
import pandas as pd

from simulation.network import build_network, ATTACKER_START, CRITICAL_TARGET, NODE_ROLES
from simulation.simulator import run_full_simulation

st.set_page_config(
    page_title="CYBER-DECEPTION AI",
    page_icon="🛡️",
    layout="wide",
)

# ---------------------------------------------------------------------------
# STYLE
# ---------------------------------------------------------------------------
st.markdown("""
<style>
    .main-title { font-size: 2.1rem; font-weight: 800; color: #00E5A0; margin-bottom: 0; }
    .subtitle { font-size: 1.05rem; color: #9fb3c8; margin-top: 0; margin-bottom: 1.2rem; }
    .metric-card {
        background: linear-gradient(145deg, #101826, #0b111c);
        border: 1px solid #1f2c3d;
        border-radius: 12px;
        padding: 18px 20px;
        text-align: center;
    }
    .metric-value { font-size: 1.9rem; font-weight: 800; color: #00E5A0; }
    .metric-label { font-size: 0.85rem; color: #9fb3c8; text-transform: uppercase; letter-spacing: 0.05em; }
    .status-badge {
        display: inline-block; padding: 4px 14px; border-radius: 20px;
        background: #1f2c3d; color: #ffcc66; font-weight: 700; font-size: 0.85rem;
    }
    .explain-box {
        background: #0d1520; border-left: 3px solid #00E5A0;
        padding: 10px 16px; margin-bottom: 8px; border-radius: 6px; font-size: 0.92rem;
    }
    .result-deceived { color: #00E5A0; font-weight: 800; font-size: 1.3rem; }
    .result-failed { color: #ff5c5c; font-weight: 800; font-size: 1.3rem; }
</style>
""", unsafe_allow_html=True)

st.markdown('<p class="main-title">🛡️ CYBER-DECEPTION AI</p>', unsafe_allow_html=True)
st.markdown('<p class="subtitle">Intelligent Honeypot Placement &amp; Attacker Path Prediction</p>', unsafe_allow_html=True)
st.caption("An AI-based simulated cyber deception environment for studying intelligent attacker-defender "
           "decision making. All nodes and events are fictional/simulated — no real hacking or offensive "
           "cybersecurity functionality is implemented.")

# ---------------------------------------------------------------------------
# SIDEBAR NAVIGATION
# ---------------------------------------------------------------------------
st.sidebar.title("Navigation")
page = st.sidebar.radio(
    "Go to",
    ["Dashboard", "Network Simulation", "Attack Path Analysis", "Attack Simulation",
     "AI Explanation Panel", "Agent Architecture"],
)

st.sidebar.divider()
attacker_strategy = st.sidebar.selectbox("Attacker Strategy", ["A*", "UCS", "BFS", "DFS"], index=0)
demo_clicked = st.sidebar.button("🎬 Run Demo Scenario", use_container_width=True)

# ---------------------------------------------------------------------------
# SIMULATION STATE
# ---------------------------------------------------------------------------
if "sim_result" not in st.session_state or demo_clicked:
    st.session_state.sim_result = run_full_simulation(attacker_strategy=attacker_strategy)
    st.session_state.attack_started = demo_clicked  # auto-run attack on demo click

if st.session_state.get("last_strategy") != attacker_strategy:
    st.session_state.sim_result = run_full_simulation(attacker_strategy=attacker_strategy)
    st.session_state.last_strategy = attacker_strategy

result = st.session_state.sim_result
graph = result["graph"]

# ---------------------------------------------------------------------------
# GRAPH VISUALIZATION HELPER
# ---------------------------------------------------------------------------
def plot_network(graph, highlight_path=None, honeypots=None, attacker_pos=None):
    pos = nx.spring_layout(graph, seed=42, k=1.1)
    highlight_path = highlight_path or []
    honeypots = honeypots or []

    edge_x, edge_y = [], []
    highlight_edges_x, highlight_edges_y = [], []
    path_edges = set(zip(highlight_path, highlight_path[1:])) | set(zip(highlight_path[1:], highlight_path))

    for u, v in graph.edges():
        x0, y0 = pos[u]
        x1, y1 = pos[v]
        if (u, v) in path_edges:
            highlight_edges_x += [x0, x1, None]
            highlight_edges_y += [y0, y1, None]
        else:
            edge_x += [x0, x1, None]
            edge_y += [y0, y1, None]

    edge_trace = go.Scatter(x=edge_x, y=edge_y, line=dict(width=1, color="#334155"),
                             hoverinfo="none", mode="lines")
    highlight_trace = go.Scatter(x=highlight_edges_x, y=highlight_edges_y,
                                  line=dict(width=4, color="#00E5A0"),
                                  hoverinfo="none", mode="lines")

    node_x, node_y, node_color, node_text, node_symbol, node_size = [], [], [], [], [], []
    for node in graph.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        role = NODE_ROLES.get(node, "normal")

        if node == attacker_pos:
            node_color.append("#ff5c5c")
            node_symbol.append("diamond")
            node_size.append(30)
        elif node in honeypots:
            node_color.append("#ffcc66")
            node_symbol.append("hexagon")
            node_size.append(26)
        elif role == "critical":
            node_color.append("#ff5c5c")
            node_symbol.append("square")
            node_size.append(28)
        else:
            node_color.append("#3ea6ff")
            node_symbol.append("circle")
            node_size.append(22)

        node_text.append(node)

    node_trace = go.Scatter(
        x=node_x, y=node_y, mode="markers+text", text=node_text,
        textposition="top center", textfont=dict(color="#e6edf3", size=12),
        marker=dict(size=node_size, color=node_color, symbol=node_symbol,
                    line=dict(width=2, color="#0b111c")),
        hoverinfo="text",
    )

    fig = go.Figure(data=[edge_trace, highlight_trace, node_trace])
    fig.update_layout(
        showlegend=False, plot_bgcolor="#0b111c", paper_bgcolor="#0b111c",
        margin=dict(l=10, r=10, t=10, b=10),
        xaxis=dict(showgrid=False, zeroline=False, visible=False),
        yaxis=dict(showgrid=False, zeroline=False, visible=False),
        height=480,
    )
    return fig

# ---------------------------------------------------------------------------
# PAGE: DASHBOARD
# ---------------------------------------------------------------------------
if page == "Dashboard":
    detection_prob = 86 if result["intercepted"] else 42

    cols = st.columns(5)
    metrics = [
        ("Total Network Nodes", graph.number_of_nodes()),
        ("Critical Assets", sum(1 for r in NODE_ROLES.values() if r == "critical")),
        ("Active Honeypots", len(result["selected_honeypots"])),
        ("Attack Detection Probability", f"{detection_prob}%"),
        ("Current Attack Status", "DECEIVED" if result["intercepted"] else "UNDER SIMULATION"),
    ]
    for col, (label, value) in zip(cols, metrics):
        col.markdown(f"""
        <div class="metric-card">
            <div class="metric-value">{value}</div>
            <div class="metric-label">{label}</div>
        </div>
        """, unsafe_allow_html=True)

    st.write("")
    st.info("The system models an attacker and defender as intelligent agents operating in a "
            "simulated network environment.")

    st.subheader("Network Overview")
    st.plotly_chart(
        plot_network(graph, honeypots=result["selected_honeypots"]),
        use_container_width=True,
    )

# ---------------------------------------------------------------------------
# PAGE: NETWORK SIMULATION
# ---------------------------------------------------------------------------
elif page == "Network Simulation":
    st.subheader("Simulated Network Graph")
    st.caption("🔵 Normal node   🟥 Critical asset   🟨 Honeypot   🔺 Attacker position")
    st.plotly_chart(
        plot_network(graph, highlight_path=result["attacker_decision"]["path"],
                     honeypots=result["selected_honeypots"], attacker_pos=ATTACKER_START),
        use_container_width=True,
    )

    st.subheader("Graph Data Structure")
    edge_rows = [{"From": u, "To": v, "Edge Cost": d["weight"]} for u, v, d in graph.edges(data=True)]
    st.dataframe(pd.DataFrame(edge_rows), use_container_width=True, hide_index=True)

# ---------------------------------------------------------------------------
# PAGE: ATTACK PATH ANALYSIS
# ---------------------------------------------------------------------------
elif page == "Attack Path Analysis":
    st.subheader("Attack Path Analysis — Search Algorithm Comparison")

    rows = []
    for name, res in result["algo_results"].items():
        rows.append({
            "Algorithm": name,
            "Path": " → ".join(res["path"]) if res["path"] else "No path found",
            "Cost": res["cost"],
            "Nodes Explored": res["nodes_explored"],
        })
    df = pd.DataFrame(rows)

    def highlight_selected(row):
        if row["Algorithm"] == result["attacker_decision"]["strategy"]:
            return ["background-color: #103826; color: #00E5A0; font-weight: 700"] * len(row)
        return [""] * len(row)

    st.dataframe(df.style.apply(highlight_selected, axis=1), use_container_width=True, hide_index=True)
    st.caption(f"Highlighted row = the attacker agent's selected strategy "
               f"({result['attacker_decision']['strategy']}), used for the actual simulation below.")

    st.subheader("Selected Path Visualization")
    st.plotly_chart(
        plot_network(graph, highlight_path=result["attacker_decision"]["path"]),
        use_container_width=True,
    )

# ---------------------------------------------------------------------------
# PAGE: ATTACK SIMULATION
# ---------------------------------------------------------------------------
elif page == "Attack Simulation":
    st.subheader("Defender: Honeypot Placement")

    hp_rows = result["honeypot_table"]
    hp_df = pd.DataFrame(hp_rows)
    st.dataframe(hp_df, use_container_width=True, hide_index=True)
    st.success(f"Recommended Honeypot Locations: {', '.join(result['selected_honeypots'])}")

    st.divider()
    st.subheader("Run Attack Simulation")

    if st.button("▶️ START ATTACK SIMULATION", type="primary"):
        st.session_state.attack_started = True

    if st.session_state.get("attack_started"):
        path = result["attacker_decision"]["path"]

        progress_placeholder = st.empty()
        graph_placeholder = st.empty()

        # Animate attacker moving through path
        for i, node in enumerate(path):
            hit = node in result["selected_honeypots"]
            progress_placeholder.markdown(
                f"**Attacker moving:** {' → '.join(path[:i+1])}" +
                (f"  🚨 **Reached honeypot: {node}**" if hit else "")
            )
            graph_placeholder.plotly_chart(
                plot_network(graph, highlight_path=path[:i+1],
                             honeypots=result["selected_honeypots"], attacker_pos=node),
                use_container_width=True,
                key=f"anim_{i}",
            )
            if hit:
                break

        st.divider()
        st.subheader("Defender Result")

        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**ATTACKER PATH**")
            st.code(" → ".join(path))
            st.markdown("**HONEYPOT(S) DEPLOYED**")
            st.code(", ".join(result["selected_honeypots"]))
        with c2:
            st.markdown("**DETECTION PROBABILITY**")
            st.code(f"{86 if result['intercepted'] else 42}%")
            st.markdown("**DATABASE STATUS**")
            st.code("PROTECTED" if result["intercepted"] else "COMPROMISED")

        if result["intercepted"]:
            st.markdown('<p class="result-deceived">🚨 ATTACKER DECEIVED — Honeypot Triggered — '
                         'Critical Database Protected</p>', unsafe_allow_html=True)
        else:
            st.markdown('<p class="result-failed">⚠️ DECEPTION FAILED — Database Reached</p>',
                         unsafe_allow_html=True)
    else:
        st.info("Click **START ATTACK SIMULATION** to run the attacker agent along its selected path.")

# ---------------------------------------------------------------------------
# PAGE: AI EXPLANATION PANEL
# ---------------------------------------------------------------------------
elif page == "AI Explanation Panel":
    st.subheader("Why Did the AI Make This Decision?")
    for line in result["explanations"]:
        st.markdown(f'<div class="explain-box">{line}</div>', unsafe_allow_html=True)

    st.divider()
    st.subheader("Algorithm Notes (for viva)")
    st.markdown("""
- **BFS** explores level-by-level and guarantees the fewest hops, but ignores edge cost.
- **DFS** explores deeply along one branch before backtracking; not guaranteed optimal or complete-efficient.
- **UCS** always expands the lowest cumulative-cost frontier node (priority queue); guarantees the minimum-cost path.
- **A\\*** = UCS + heuristic. It expands nodes minimizing `f(n) = g(n) + h(n)`, where `g(n)` is the real cost so far
  and `h(n)` is an admissible estimate (here, hop-distance to the target scaled by the graph's minimum edge weight).
  This lets A* reach the optimal path while typically exploring fewer nodes than UCS.
""")

# ---------------------------------------------------------------------------
# PAGE: AGENT ARCHITECTURE
# ---------------------------------------------------------------------------
elif page == "Agent Architecture":
    st.subheader("Intelligent Agent Architecture")

    stages = [
        ("PERCEPTION", "Agents perceive the current network state (nodes, edges, roles)."),
        ("NETWORK STATE", "The environment is represented as a weighted graph (state space)."),
        ("ATTACKER AGENT", "Goal-based agent aiming to reach the critical Database node."),
        ("SEARCH", "BFS / DFS / UCS / A* explore the state space to find candidate paths."),
        ("DEFENDER AGENT", "Utility-based agent aiming to intercept the attacker before the target."),
        ("HONEYPOT OPTIMIZATION", "Local-search-style scoring selects the best deception nodes."),
        ("ATTACK SIMULATION", "The attacker agent moves along its chosen path, step by step."),
        ("DECISION", "System reports whether the attacker was deceived or the target was reached."),
    ]

    for i, (title, desc) in enumerate(stages):
        st.markdown(f"**{i+1}. {title}**")
        st.caption(desc)
        if i < len(stages) - 1:
            st.markdown("<div style='text-align:center; color:#00E5A0;'>↓</div>", unsafe_allow_html=True)

st.sidebar.divider()
st.sidebar.caption("Educational simulation only. No real hosts, exploitation, or offensive "
                    "cybersecurity functionality is implemented.")
