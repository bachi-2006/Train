from __future__ import annotations

import json
import os
from typing import Dict, List, Tuple
from scenario_schema import (
    Scenario,
    TrainInput,
    TrackSectionInput,
    StationInput,
    ConstraintsInput,
    SimulationInput,
    priority_value,
)
from rail_decision_engine import (
    RailNetwork,
    Edge,
    Train,
    BlockOccupancy,
    detect_block_conflicts,
    decide_precedence,
    propagate_delay_simple,
    run_simulation,
    compute_kpis,
)
from stations_csv_loader import load_stations_from_csv, load_sections_from_csv


def parse_scenario(obj: Dict) -> Scenario:
    # Whitelist only the allowed train fields
    allowed = {
        "train_id",
        "name",
        "train_type",
        "priority_level",
        "speed_kmph",
        "length_m",
        "sched_departure",
        "sched_arrival",
        "source",
        "destination",
    }
    trains = [TrainInput(**{k: v for k, v in t.items() if k in allowed}) for t in obj["trains"]]
    sections = [TrackSectionInput(**s) for s in obj.get("sections", [])]
    stations = [StationInput(**st) for st in obj.get("stations", [])]
    constraints = ConstraintsInput(**obj["constraints"])
    simulation = SimulationInput(**obj["simulation"])
    return Scenario(trains=trains, sections=sections, stations=stations, constraints=constraints, simulation=simulation)


def build_network(sections: List[TrackSectionInput]) -> RailNetwork:
    nodes = set()
    edges: Dict[str, List[Edge]] = {}
    for s in sections:
        nodes.add(s.from_node)
        nodes.add(s.to_node)
        edges.setdefault(s.from_node, []).append(Edge(s.from_node, s.to_node, s.travel_time_min))
        if s.availability in ("double", "loop"):
            edges.setdefault(s.to_node, []).append(Edge(s.to_node, s.from_node, s.travel_time_min))
    return RailNetwork(nodes=nodes, edges=edges)


def shortest_path(sections: List[TrackSectionInput], start: str, end: str) -> List[str]:
    # Simple Dijkstra to find shortest path by travel time
    graph = {}
    for s in sections:
        graph.setdefault(s.from_node, []).append((s.to_node, s.travel_time_min))
        if s.availability in ("double", "loop"):
            graph.setdefault(s.to_node, []).append((s.from_node, s.travel_time_min))
    
    import heapq
    queue = [(0, start, [])]
    visited = set()
    while queue:
        cost, node, path = heapq.heappop(queue)
        if node in visited:
            continue
        visited.add(node)
        path = path + [node]
        if node == end:
            return path
        for neighbor, weight in graph.get(node, []):
            if neighbor not in visited:
                heapq.heappush(queue, (cost + weight, neighbor, path))
    return []  # no path


def _estimate_travel_time(route: List[str], sections: List[TrackSectionInput]) -> float:
    total = 0.0
    for i in range(len(route) - 1):
        u = route[i]
        v = route[i + 1]
        tt = next((s.travel_time_min for s in sections if s.from_node == u and s.to_node == v), 5.0)
        total += tt
    return total


def _estimate_conflicts(route: List[str], trains_built: List[Train], sections: List[TrackSectionInput]) -> int:
    # Build a hypothetical single train with zero-based occupancy along this route
    current_time = 0.0
    occ: List[BlockOccupancy] = []
    for i in range(len(route) - 1):
        u = route[i]
        v = route[i + 1]
        block_id = f"{u}-{v}"
        tt = next((s.travel_time_min for s in sections if s.from_node == u and s.to_node == v), 5.0)
        occ.append(BlockOccupancy(block_id, current_time, current_time + tt))
        current_time += tt
    probe = Train(train_id="__probe__", category="passenger", priority=1, planned_path=route, occupancies=occ)
    conflicts = detect_block_conflicts(trains_built + [probe])
    return sum(1 for c in conflicts if c[1] == "__probe__" or c[2] == "__probe__")


def build_trains(scn: Scenario) -> List[Train]:
    trains: List[Train] = []
    for t in scn.trains[: scn.simulation.num_trains]:
        prio = priority_value(t.priority_level)
        # Compute route if not provided
        main_route = t.route_path if t.route_path else shortest_path(scn.sections, t.source, t.destination)
        if not main_route:
            print(f"Warning: no path found for train {t.train_id} from '{t.source}' to '{t.destination}' using loaded sections.")
            # Skip building occupancies for this train, continue to next
            continue
        alt_route = t.alternative_route_path if t.alternative_route_path else None
        # choose between main route and alternative using travel time + alpha * predicted conflicts
        alpha = 30.0  # minutes penalty per predicted conflict
        main_tt = _estimate_travel_time(main_route, scn.sections)
        main_cf = _estimate_conflicts(main_route, trains, scn.sections) if trains else 0
        main_cost = main_tt + alpha * main_cf
        chosen_route = main_route
        if alt_route:
            alt_tt = _estimate_travel_time(alt_route, scn.sections)
            alt_cf = _estimate_conflicts(alt_route, trains, scn.sections) if trains else 0
            alt_cost = alt_tt + alpha * alt_cf
            if alt_cost < main_cost:
                chosen_route = alt_route

        occupancies: List[BlockOccupancy] = []
        current_time = 0.0
        for i in range(len(chosen_route) - 1):
            u = chosen_route[i]
            v = chosen_route[i + 1]
            block_id = f"{u}-{v}"
            tt = next((s.travel_time_min for s in scn.sections if s.from_node == u and s.to_node == v), 5.0)
            occupancies.append(BlockOccupancy(block_id, current_time, current_time + tt))
            current_time += tt
        trains.append(
            Train(
                train_id=t.train_id,
                category=t.train_type.lower(),
                priority=prio,
                planned_path=chosen_route,  # chosen main or alternative
                occupancies=occupancies,
                delay_minutes=0.0,
            )
        )
    return trains


def enforce_headway(trains: List[Train], min_headway_min: float) -> None:
    # For each block, ensure consecutive occupancies start at least headway apart; if not, shift later train
    block_to_entries: Dict[str, List[Tuple[float, Train, BlockOccupancy]]] = {}
    for t in trains:
        for occ in t.occupancies:
            block_to_entries.setdefault(occ.block_id, []).append((occ.start_time, t, occ))
    for block_id, entries in block_to_entries.items():
        entries.sort(key=lambda x: x[0])
        last_time = None
        for idx, (start, t, occ) in enumerate(entries):
            if last_time is None:
                last_time = start
                continue
            if start - last_time < min_headway_min:
                delta = (min_headway_min - (start - last_time))
                # shift all subsequent occupancies of this train forward by delta
                for o in t.occupancies:
                    o.start_time += delta
                    o.end_time += delta
                start += delta
            last_time = start


def run_scenario_json(path: str, stations_csv: str = "", sections_csv: str = "") -> None:
    with open(path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    scn = parse_scenario(obj)
    # Ignore any stations defined in JSON; use dataset only
    scn.stations = []
    # Auto-detect default CSVs if not provided
    if not stations_csv:
        maybe_stations = "with connecting junction - with connecting junction.csv"
        if os.path.exists(maybe_stations):
            stations_csv = maybe_stations
    if not sections_csv:
        maybe_sections = "form every station to every station - form every station to every station.csv"
        if os.path.exists(maybe_sections):
            sections_csv = maybe_sections

    if stations_csv:
        csv_stations = load_stations_from_csv(stations_csv)
        # replace stations entirely with dataset
        scn.stations = csv_stations
    if sections_csv:
        csv_sections = load_sections_from_csv(sections_csv)
        # replace or merge sections - here we replace
        scn.sections = csv_sections
    network = build_network(scn.sections)
    trains = build_trains(scn)
    enforce_headway(trains, scn.constraints.min_headway_min)
    conflicts = detect_block_conflicts(trains)
    id_pairs = {tuple(sorted((a, b))) for _, a, b, _ in conflicts}
    decisions = decide_precedence(list(id_pairs), {t.train_id: t for t in trains})
    # Output format: conflicts and decisions only
    print("Conflicts:")
    for c in conflicts:
        print(c)
    print("Decisions:")
    for tid, action in decisions.items():
        print(f"{tid} -> {action}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("scenario", help="Path to scenario JSON file")
    parser.add_argument("--stations_csv", default="", help="Optional CSV file with station definitions to merge")
    parser.add_argument("--sections_csv", default="", help="Optional CSV file with track sections to use")
    args = parser.parse_args()
    run_scenario_json(args.scenario, args.stations_csv, args.sections_csv)


