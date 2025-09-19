from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Set
import heapq


# -----------------------------
# Core domain data structures
# -----------------------------


@dataclass
class BlockOccupancy:
    block_id: str
    start_time: float
    end_time: float


@dataclass
class Train:
    train_id: str
    category: str  # "passenger", "local", "freight"
    priority: int  # higher means more important
    planned_path: List[str]  # sequence of node ids
    occupancies: List[BlockOccupancy] = field(default_factory=list)
    delay_minutes: float = 0.0


@dataclass
class Edge:
    u: str
    v: str
    weight: float  # nominal travel time (minutes)


@dataclass
class RailNetwork:
    nodes: Set[str]
    edges: Dict[str, List[Edge]]  # adjacency: node -> list of outgoing edges

    def neighbors(self, node: str) -> List[Tuple[str, float]]:
        return [(e.v, e.weight) for e in self.edges.get(node, [])]


# -----------------------------
# Conflict detection algorithms
# -----------------------------


def intervals_overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> bool:
    return not (a_end <= b_start or b_end <= a_start)


def detect_block_conflicts(trains: List[Train]) -> List[Tuple[str, str, str, Tuple[float, float]]]:
    conflicts: List[Tuple[str, str, str, Tuple[float, float]]] = []
    # index by block_id
    block_to_occ: Dict[str, List[Tuple[str, float, float]]] = {}
    for t in trains:
        for occ in t.occupancies:
            block_to_occ.setdefault(occ.block_id, []).append((t.train_id, occ.start_time, occ.end_time))
    for block_id, items in block_to_occ.items():
        items.sort(key=lambda x: x[1])
        for i in range(len(items)):
            ti, si, ei = items[i]
            for j in range(i + 1, len(items)):
                tj, sj, ej = items[j]
                if intervals_overlap(si, ei, sj, ej):
                    conflicts.append((block_id, ti, tj, (max(si, sj), min(ei, ej))))
                else:
                    if sj >= ei:
                        break
    return conflicts


def detect_node_edge_contention(trains: List[Train]) -> List[Tuple[str, str, str, float]]:
    # Simple event-based contention on nodes: for each node visit time, ensure only one arrival
    # Here we approximate with occupancy endpoints as node events
    events: Dict[str, List[Tuple[float, str, str]]] = {}
    for t in trains:
        for occ in t.occupancies:
            events.setdefault(occ.block_id, []).append((occ.start_time, t.train_id, "enter"))
            events.setdefault(occ.block_id, []).append((occ.end_time, t.train_id, "exit"))
    contentions: List[Tuple[str, str, str, float]] = []
    for block_id, evs in events.items():
        evs.sort()
        active: Set[str] = set()
        for ts, train_id, kind in evs:
            if kind == "enter":
                for other in active:
                    contentions.append((block_id, train_id, other, ts))
                active.add(train_id)
            else:
                active.discard(train_id)
    return contentions


# -----------------------------
# Precedence decision
# -----------------------------


def compute_priority_score(train: Train, delay_factor: float = 0.1) -> float:
    return train.priority * (1.0 + delay_factor * max(0.0, train.delay_minutes))


def decide_precedence(conflict_pairs: List[Tuple[str, str]], trains_by_id: Dict[str, Train]) -> Dict[str, str]:
    # returns mapping train_id -> action {"PROCEED", "HOLD"}
    decisions: Dict[str, str] = {}
    for a, b in conflict_pairs:
        ta = trains_by_id[a]
        tb = trains_by_id[b]
        sa = compute_priority_score(ta)
        sb = compute_priority_score(tb)
        if sa >= sb:
            decisions.setdefault(a, "PROCEED")
            decisions.setdefault(b, "HOLD")
        else:
            decisions.setdefault(b, "PROCEED")
            decisions.setdefault(a, "HOLD")
    return decisions


# -----------------------------
# Routing algorithms
# -----------------------------


def dijkstra_shortest_path(network: RailNetwork, start: str, goal: str) -> Optional[Tuple[float, List[str]]]:
    pq: List[Tuple[float, str]] = [(0.0, start)]
    dist: Dict[str, float] = {start: 0.0}
    prev: Dict[str, Optional[str]] = {start: None}
    visited: Set[str] = set()
    while pq:
        d, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        if u == goal:
            break
        for v, w in network.neighbors(u):
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    if goal not in dist:
        return None
    # reconstruct path
    path: List[str] = []
    cur: Optional[str] = goal
    while cur is not None:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()
    return dist[goal], path


def reroute_if_needed(train: Train, network: RailNetwork, current_node: str, goal_node: str) -> Optional[List[str]]:
    res = dijkstra_shortest_path(network, current_node, goal_node)
    if not res:
        return None
    _, path = res
    return path


# -----------------------------
# Delay and ETA estimation
# -----------------------------


def estimate_eta_minutes(path: List[str], network: RailNetwork, start_time: float, base_delay: float = 0.0) -> float:
    total = base_delay
    for i in range(len(path) - 1):
        u = path[i]
        v = path[i + 1]
        # find edge weight
        w = None
        for e in network.edges.get(u, []):
            if e.v == v:
                w = e.weight
                break
        if w is None:
            return float("inf")
        total += w
    return start_time + total


def propagate_delay_simple(trains: List[Train], added_delay_per_conflict: float = 2.0) -> None:
    # Simple heuristic: each conflict adds delay to HOLD trains
    id_to_train: Dict[str, Train] = {t.train_id: t for t in trains}
    pairs: List[Tuple[str, str, str, Tuple[float, float]]] = detect_block_conflicts(trains)
    unique_pairs: Set[Tuple[str, str]] = set()
    for _, a, b, _ in pairs:
        key = tuple(sorted((a, b)))
        unique_pairs.add(key)
    decisions = decide_precedence(list(unique_pairs), id_to_train)
    for tid, action in decisions.items():
        if action == "HOLD":
            id_to_train[tid].delay_minutes += added_delay_per_conflict


# -----------------------------
# Discrete-event simulation skeleton
# -----------------------------


@dataclass
class Event:
    time: float
    kind: str  # "enter_block" | "exit_block"
    train_id: str
    block_id: str


def run_simulation(trains: List[Train]) -> List[str]:
    log: List[str] = []
    # Build initial event queue
    pq: List[Tuple[float, int, Event]] = []
    counter = 0
    for t in trains:
        for occ in t.occupancies:
            heapq.heappush(pq, (occ.start_time, counter, Event(occ.start_time, "enter_block", t.train_id, occ.block_id)))
            counter += 1
            heapq.heappush(pq, (occ.end_time, counter, Event(occ.end_time, "exit_block", t.train_id, occ.block_id)))
            counter += 1
    occupied: Dict[str, Optional[str]] = {}
    while pq:
        ts, _, ev = heapq.heappop(pq)
        if ev.kind == "enter_block":
            if occupied.get(ev.block_id) is None:
                occupied[ev.block_id] = ev.train_id
                log.append(f"{ts:.1f} ENTER {ev.block_id} {ev.train_id}")
            else:
                holder = occupied[ev.block_id]
                log.append(f"{ts:.1f} CONFLICT {ev.block_id} {ev.train_id} vs {holder}")
        else:
            if occupied.get(ev.block_id) == ev.train_id:
                occupied[ev.block_id] = None
                log.append(f"{ts:.1f} EXIT {ev.block_id} {ev.train_id}")
            else:
                log.append(f"{ts:.1f} EXIT_WAIT {ev.block_id} {ev.train_id}")
    return log


# -----------------------------
# KPIs
# -----------------------------


def compute_kpis(trains: List[Train], sim_log: List[str]) -> Dict[str, float]:
    n = max(1, len(trains))
    avg_delay = sum(t.delay_minutes for t in trains) / n
    throughput = sum(1 for line in sim_log if "EXIT" in line and "EXIT_WAIT" not in line)
    # utilization: fraction of time blocks were occupied (approximate via events)
    block_times: Dict[str, float] = {}
    last_enter: Dict[str, float] = {}
    for line in sim_log:
        parts = line.split()
        ts = float(parts[0])
        kind = parts[1]
        block_id = parts[2]
        if kind == "ENTER":
            last_enter[block_id] = ts
        if kind == "EXIT":
            if block_id in last_enter:
                block_times[block_id] = block_times.get(block_id, 0.0) + (ts - last_enter[block_id])
                last_enter.pop(block_id, None)
    total_time = 1.0
    if sim_log:
        first_ts = float(sim_log[0].split()[0])
        last_ts = float(sim_log[-1].split()[0])
        total_time = max(1.0, last_ts - first_ts)
    utilization = 0.0
    if block_times:
        utilization = sum(block_times.values()) / (len(block_times) * total_time)
    # punctuality: percent with zero additional delay
    punctuality = 100.0 * sum(1 for t in trains if t.delay_minutes <= 0.01) / n
    return {
        "average_delay": avg_delay,
        "throughput": float(throughput),
        "utilization": utilization,
        "punctuality": punctuality,
    }


# -----------------------------
# Minimal demo helper
# -----------------------------


def minimal_demo() -> None:
    network = RailNetwork(
        nodes={"A", "B", "C", "D"},
        edges={
            "A": [Edge("A", "B", 5.0), Edge("A", "D", 6.0)],
            "B": [Edge("B", "C", 5.0)],
            "D": [Edge("D", "C", 5.0)],
        },
    )
    t1 = Train(
        train_id="EXP205",
        category="passenger",
        priority=5,
        planned_path=["A", "B", "C"],
        delay_minutes=15.0,
        occupancies=[
            BlockOccupancy("A-B", 0.0, 5.0),
            BlockOccupancy("B-C", 5.0, 10.0),
        ],
    )
    t2 = Train(
        train_id="LOC401",
        category="local",
        priority=3,
        planned_path=["A", "D", "C"],
        delay_minutes=0.0,
        occupancies=[
            BlockOccupancy("A-D", 1.0, 7.0),
            BlockOccupancy("D-C", 7.0, 12.0),
        ],
    )
    t3 = Train(
        train_id="FRT309",
        category="freight",
        priority=2,
        planned_path=["B", "C"],
        delay_minutes=0.0,
        occupancies=[
            BlockOccupancy("B-C", 4.0, 12.0),
        ],
    )
    t4 = Train(
        train_id="VandeBharath",
        category="passenger",
        priority=1,
        planned_path=["A", "B", "C"],
        delay_minutes=0.0,
        occupancies=[
            BlockOccupancy("A-B", 2.0, 6.0),
            BlockOccupancy("B-C", 6.0, 11.0),
        ],
    )
    trains = [t1, t2, t3, t4]
    block_conflicts = detect_block_conflicts(trains)
    id_pairs: Set[Tuple[str, str]] = set()
    for _, a, b, _ in block_conflicts:
        id_pairs.add(tuple(sorted((a, b))))
    decisions = decide_precedence(list(id_pairs), {t.train_id: t for t in trains})
    propagate_delay_simple(trains)
    log = run_simulation(trains)
    kpis = compute_kpis(trains, log)
    print("Conflicts:")
    for c in block_conflicts:
        print(c)
    print("Decisions:")
    print(decisions)
    print("Sim log:")
    for line in log:
        print(line)
    print("KPIs:")
    print(kpis)


if __name__ == "__main__":
    minimal_demo()


