"""
Fraud Network Graph Intelligence.

Takes multiple citizen fraud reports and finds ones that share
infrastructure (a phone number, bank account, UPI ID, or case reference
mentioned by the scammer) — connected reports form a cluster, which is a
detectable signature of a single organised fraud operation contacting
multiple victims, rather than isolated incidents.

Entity extraction here is regex-based (fast, zero cost, runs without any
LLM). In production this stage is a natural place to add LLM-based entity
extraction for messier, less structured report text; the graph and
clustering logic downstream doesn't change either way.
"""

import base64
import io
import re
from dataclasses import dataclass, field

import networkx as nx
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ENTITY_PATTERNS = {
    "phone": r"\b[6-9]\d{9}\b",
    "account": r"\b\d{9,18}\b",
    "upi": r"\b[\w.\-]{2,}@[a-zA-Z]{2,}\b",
    "case_ref": r"\b[A-Z]{2,4}[/-][A-Z0-9]{2,6}[/-]\d{2,6}\b",
}


@dataclass
class GraphResult:
    n_reports: int
    n_entities: int
    clusters: list = field(default_factory=list)  # list of dicts
    image_base64: str = ""


def extract_entities(text: str) -> list[tuple[str, str]]:
    found = []
    for etype, pattern in ENTITY_PATTERNS.items():
        for m in re.finditer(pattern, text):
            found.append((etype, m.group()))
    # account pattern can accidentally re-match a phone number's digits;
    # drop account matches that are already captured as phone numbers.
    phones = {v for t, v in found if t == "phone"}
    found = [(t, v) for t, v in found if not (t == "account" and v in phones)]
    return list(set(found))


def build_graph(reports: list[dict]) -> nx.Graph:
    g = nx.Graph()
    for r in reports:
        report_node = f"report::{r['id']}"
        g.add_node(report_node, kind="report", city=r.get("city", ""))
        for etype, value in extract_entities(r["text"]):
            entity_node = f"{etype}::{value}"
            g.add_node(entity_node, kind=etype, value=value)
            g.add_edge(report_node, entity_node)
    return g


def find_clusters(g: nx.Graph, reports_by_id: dict) -> list[dict]:
    clusters = []
    for component in nx.connected_components(g):
        report_ids = sorted(n.split("::", 1)[1] for n in component if n.startswith("report::"))
        entities = sorted(n.split("::", 1)[1] for n in component if not n.startswith("report::"))
        if len(report_ids) < 2:
            continue  # a lone report with no shared infrastructure isn't a "ring"
        clusters.append({
            "cluster_size": len(report_ids),
            "report_ids": report_ids,
            "cities": sorted({reports_by_id[rid].get("city", "") for rid in report_ids if rid in reports_by_id}),
            "shared_entities": entities,
        })
    clusters.sort(key=lambda c: c["cluster_size"], reverse=True)
    return clusters


def render_graph(g: nx.Graph) -> str:
    fig, ax = plt.subplots(figsize=(7, 5.5))
    pos = nx.spring_layout(g, seed=7, k=0.6)

    color_map = {"report": "#1B2A4A", "phone": "#D97706", "account": "#DC2626",
                 "upi": "#7C3AED", "case_ref": "#16A34A"}
    node_colors = [color_map.get(g.nodes[n].get("kind"), "#999999") for n in g.nodes]
    node_sizes = [420 if g.nodes[n].get("kind") == "report" else 260 for n in g.nodes]

    nx.draw_networkx_edges(g, pos, ax=ax, edge_color="#C7C6C0", width=1.2)
    nx.draw_networkx_nodes(g, pos, ax=ax, node_color=node_colors, node_size=node_sizes, linewidths=0)
    labels = {n: n.split("::", 1)[1] if "::" in n else n for n in g.nodes}
    nx.draw_networkx_labels(g, pos, labels=labels, ax=ax, font_size=6.5, font_color="white" if False else "#1C1C1C")

    ax.set_title("Fraud network — shared infrastructure across reports", fontsize=11)
    ax.axis("off")
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=180, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


def analyze_reports(reports: list[dict]) -> GraphResult:
    reports_by_id = {r["id"]: r for r in reports}
    g = build_graph(reports)
    clusters = find_clusters(g, reports_by_id)
    n_entities = sum(1 for n in g.nodes if not n.startswith("report::"))
    image_b64 = render_graph(g)
    return GraphResult(n_reports=len(reports), n_entities=n_entities, clusters=clusters, image_base64=image_b64)
