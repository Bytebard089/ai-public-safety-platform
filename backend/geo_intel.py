"""
Geospatial Crime Intelligence.

Aggregates citizen fraud reports by city, computes fraud density scores,
and returns GeoJSON-compatible points for the frontend India map overlay.

All city coordinates are hardcoded (no external geo API dependency) so the
module works fully offline — important for a law enforcement tool that must
function in constrained network environments.

Density scoring uses a weighted sum: high-severity reports count 3x,
medium 2x, low 1x. Cluster membership (shared fraud ring) adds a 5x
multiplier on top to surface organised operations over isolated incidents.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

# Major Indian cities with approximate centres (WGS-84).
# This covers the top 35 cities by population / cybercrime report volume
# per NCRB 2023 data, giving good national coverage for the demo.
CITY_COORDS: dict[str, tuple[float, float]] = {
    "Mumbai":     (19.076,  72.877),
    "Delhi":      (28.679,  77.069),
    "Bengaluru":  (12.972,  77.594),
    "Hyderabad":  (17.385,  78.487),
    "Ahmedabad":  (23.023,  72.572),
    "Chennai":    (13.083,  80.270),
    "Kolkata":    (22.572,  88.364),
    "Pune":       (18.520,  73.856),
    "Jaipur":     (26.912,  75.787),
    "Surat":      (21.170,  72.831),
    "Lucknow":    (26.846,  80.946),
    "Kanpur":     (26.449,  80.331),
    "Nagpur":     (21.145,  79.088),
    "Indore":     (22.719,  75.857),
    "Thane":      (19.218,  72.978),
    "Bhopal":     (23.259,  77.413),
    "Visakhapatnam": (17.686, 83.218),
    "Patna":      (25.594,  85.137),
    "Vadodara":   (22.307,  73.181),
    "Ghaziabad":  (28.670,  77.454),
    "Ludhiana":   (30.901,  75.857),
    "Agra":       (27.176,  78.008),
    "Nashik":     (20.011,  73.789),
    "Faridabad":  (28.408,  77.317),
    "Meerut":     (28.984,  77.706),
    "Rajkot":     (22.303,  70.802),
    "Varanasi":   (25.317,  82.974),
    "Srinagar":   (34.083,  74.797),
    "Aurangabad": (19.877,  75.343),
    "Dhanbad":    (23.795,  86.433),
    "Amritsar":   (31.634,  74.873),
    "Allahabad":  (25.435,  81.846),
    "Gurgaon":    (28.459,  77.026),
    "Noida":      (28.535,  77.391),
    "Coimbatore": (11.017,  76.956),
}

SEVERITY_WEIGHT = {"high": 3, "medium": 2, "low": 1}
CLUSTER_MULTIPLIER = 5   # Shared-ring reports are the highest-priority signal


@dataclass
class GeoPoint:
    city: str
    lat: float
    lon: float
    density: int          # raw weighted score
    report_count: int
    severity_breakdown: dict = field(default_factory=dict)  # {high:n, medium:n, low:n}
    in_cluster: bool = False


@dataclass
class GeoResult:
    points: list[GeoPoint]
    total_reports: int
    cities_monitored: int
    hotspot_city: str     # city with highest density


def compute_heatmap(reports: list[dict], cluster_report_ids: set[str] | None = None) -> GeoResult:
    """
    Aggregate reports by city into weighted density scores.

    Args:
        reports: List of report dicts (must have 'city', 'severity', 'id').
        cluster_report_ids: Set of report IDs that are part of a fraud ring
                            (from graph_intel clustering). These receive a
                            CLUSTER_MULTIPLIER boost.
    """
    if cluster_report_ids is None:
        cluster_report_ids = set()

    city_data: dict[str, dict] = {}

    for r in reports:
        city = r.get("city", "Unknown")
        if city not in CITY_COORDS:
            continue  # skip cities we don't have coords for

        severity = r.get("severity", "low")
        weight = SEVERITY_WEIGHT.get(severity, 1)
        if r.get("id") in cluster_report_ids:
            weight *= CLUSTER_MULTIPLIER

        if city not in city_data:
            city_data[city] = {
                "count": 0,
                "density": 0,
                "severity_breakdown": {"high": 0, "medium": 0, "low": 0},
                "in_cluster": False,
            }

        city_data[city]["count"] += 1
        city_data[city]["density"] += weight
        city_data[city]["severity_breakdown"][severity] = (
            city_data[city]["severity_breakdown"].get(severity, 0) + 1
        )
        if r.get("id") in cluster_report_ids:
            city_data[city]["in_cluster"] = True

    points: list[GeoPoint] = []
    for city, data in city_data.items():
        lat, lon = CITY_COORDS[city]
        points.append(
            GeoPoint(
                city=city,
                lat=lat,
                lon=lon,
                density=data["density"],
                report_count=data["count"],
                severity_breakdown=data["severity_breakdown"],
                in_cluster=data["in_cluster"],
            )
        )

    # Sort highest density first so the frontend can highlight top hotspots
    points.sort(key=lambda p: p.density, reverse=True)
    hotspot = points[0].city if points else "—"

    return GeoResult(
        points=points,
        total_reports=len(reports),
        cities_monitored=len(points),
        hotspot_city=hotspot,
    )


def load_demo_heatmap(data_dir: Path) -> GeoResult:
    """Load the demo fraud_reports dataset and run the heatmap analysis."""
    with open(data_dir / "fraud_reports.json") as f:
        raw = json.load(f)
    reports = raw["reports"]

    # Run graph clustering to identify ring members (reuses graph_intel logic
    # without importing it directly — keeps the module independent).
    from graph_intel import analyze_reports  # noqa: PLC0415
    graph_result = analyze_reports(reports)
    ring_ids: set[str] = set()
    for cluster in graph_result.clusters:
        for rid in cluster.get("report_ids", []):
            ring_ids.add(rid)

    return compute_heatmap(reports, cluster_report_ids=ring_ids)
