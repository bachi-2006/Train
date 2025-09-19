from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import os
import json

import generate_schedule as gs
from typing import Any
from scenario_schema import Scenario, TrainInput, ConstraintsInput, SimulationInput, TrackSectionInput, StationInput
from stations_csv_loader import load_sections_from_csv, load_stations_from_csv
from rail_decision_engine import (
    BlockOccupancy,
    Train as SimTrain,
    detect_block_conflicts,
    decide_precedence,
)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunSimulationRequest(BaseModel):
    num_trains: int = 10
    start_time_iso: str = "2025-09-19T08:00:00"


class AddTrainRequest(BaseModel):
    train_id: Optional[str] = None
    train_name: Optional[str] = None
    train_type: str = "Passenger"
    priority_level: str = "Medium"
    stations: List[str]  # list of station codes in order (5-10 preferred)
    start_time_iso: str = "2025-09-19T08:00:00"


class ScenarioTrain(BaseModel):
    train_id: str
    name: str | None = None
    train_type: str = "Passenger"
    priority_level: str = "Medium"
    source: str
    destination: str


class ScenarioConstraints(BaseModel):
    min_headway_min: float = 2.0


class ScenarioSimulation(BaseModel):
    num_trains: int = 0


class AnalyzeScenarioRequest(BaseModel):
    trains: list[ScenarioTrain]
    constraints: ScenarioConstraints = ScenarioConstraints()
    simulation: ScenarioSimulation = ScenarioSimulation()


def _load_inputs():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sih_stations_csv = os.path.join(base_dir, "with connecting junction - with connecting junction.csv")
    sih_sections_csv = os.path.join(base_dir, "form every station to every station - form every station to every station.csv")
    trainsih_stations_csv = os.path.join(os.path.dirname(base_dir), "Trainsih", "add 20 more stations - add 20 more stations.csv")
    out_dir = os.path.join(base_dir, "data")
    os.makedirs(out_dir, exist_ok=True)
    return base_dir, sih_stations_csv, sih_sections_csv, trainsih_stations_csv, out_dir


@app.post("/run-simulation")
def run_simulation(req: RunSimulationRequest):
    _, sih_stations_csv, sih_sections_csv, trainsih_stations_csv, out_dir = _load_inputs()

    merged_stations = gs.merge_stations(sih_stations_csv, trainsih_stations_csv)
    real_sections = gs.load_real_sections(sih_sections_csv)
    augmented_sections = gs.augment_sections_with_knn(merged_stations, real_sections, k=3, avg_speed_kmph=70.0)

    schedule = gs.generate_trains_schedule(merged_stations, augmented_sections, num_trains=req.num_trains, start_time_iso=req.start_time_iso)

    # Write outputs for inspection
    gs.write_master_stations(os.path.join(out_dir, "master_stations.csv"), merged_stations)
    gs.write_augmented_sections(os.path.join(out_dir, "augmented_sections.csv"), augmented_sections)
    gs.write_schedule(os.path.join(out_dir, "train_schedule.csv"), schedule)

    # Return JSON
    return {
        "stations": [
            {
                "code": st.code,
                "name": st.name,
                "platform_count": st.platform_count,
                "halt_min": st.halt_min,
                "latitude": st.lat,
                "longitude": st.lon,
            }
            for st in merged_stations.values()
        ],
        "sections": [
            {
                "from_code": s.from_code,
                "to_code": s.to_code,
                "distance_km": s.distance_km,
                "travel_min": s.travel_min,
                "leg_type": s.leg_type,
            }
            for s in augmented_sections
        ],
        "schedule": [s.__dict__ for s in schedule],
    }


@app.post("/add-train")
def add_train(req: AddTrainRequest):
    # Build a schedule entry for a user-provided station chain
    _, sih_stations_csv, sih_sections_csv, trainsih_stations_csv, out_dir = _load_inputs()

    merged_stations = gs.merge_stations(sih_stations_csv, trainsih_stations_csv)
    real_sections = gs.load_real_sections(sih_sections_csv)
    augmented_sections = gs.augment_sections_with_knn(merged_stations, real_sections, k=3, avg_speed_kmph=70.0)
    adj = gs.build_adjacency(augmented_sections)

    # Convert the custom stations into contiguous sections, inferring where needed via adjacency
    path_sections: List[gs.Section] = []
    for i in range(len(req.stations) - 1):
        a = req.stations[i]
        b = req.stations[i + 1]
        candidates = [sec for nxt, sec in adj.get(a, []) if nxt == b]
        if candidates:
            path_sections.append(candidates[0])
        else:
            # fabricate a direct inferred leg using coordinates
            sa = merged_stations.get(a)
            sb = merged_stations.get(b)
            if not sa or not sb or sa.lat is None or sa.lon is None or sb.lat is None or sb.lon is None:
                continue
            dist = gs.haversine_km(sa.lat, sa.lon, sb.lat, sb.lon)
            travel_min = (dist / 70.0) * 60.0
            path_sections.append(gs.Section(from_code=a, from_name=sa.name, to_code=b, to_name=sb.name, distance_km=dist, travel_min=travel_min, leg_type="inferred"))

    # Wrap into a schedule for 1 train using requested meta
    tid = req.train_id or f"USR{abs(hash(tuple(req.stations)))%100000:05d}"
    tname = req.train_name or "User Train"
    # Temporarily create a fake sections list and call generator's timeline code by mimicking its logic
    schedule: List[Dict[str, Any]] = []
    if not path_sections:
        return {"error": "No valid path built from provided stations"}

    # Build timeline (mostly copied semantics from generator)
    from datetime import datetime, timedelta
    start_dt = datetime.fromisoformat(req.start_time_iso)
    elapsed = 0.0
    origin = merged_stations.get(path_sections[0].from_code)
    if origin is None:
        return {"error": "Origin not found"}
    schedule.append({
        "train_id": tid,
        "train_name": tname,
        "train_type": req.train_type,
        "priority_level": req.priority_level,
        "stop_index": 0,
        "station_code": origin.code,
        "station_name": origin.name,
        "latitude": origin.lat,
        "longitude": origin.lon,
        "arrive_time_iso": start_dt.isoformat(),
        "depart_time_iso": start_dt.isoformat(),
        "eta_minutes_from_start": elapsed,
        "from_code": "",
        "to_code": path_sections[0].to_code,
        "section_travel_time_min": 0.0,
        "halt_time_min_at_station": origin.halt_min,
        "leg_type": "origin",
    })
    current_time = start_dt
    stop_index = 1
    for sec in path_sections:
        travel_min = max(1.0, sec.travel_min)
        current_time = current_time + timedelta(minutes=travel_min)
        elapsed += travel_min
        to_st = merged_stations.get(sec.to_code)
        if to_st is None:
            continue
        arrive_iso = current_time.isoformat()
        halt = max(0.0, to_st.halt_min)
        current_time = current_time + timedelta(minutes=halt)
        depart_iso = current_time.isoformat()
        elapsed += halt
        schedule.append({
            "train_id": tid,
            "train_name": tname,
            "train_type": req.train_type,
            "priority_level": req.priority_level,
            "stop_index": stop_index,
            "station_code": to_st.code,
            "station_name": to_st.name,
            "latitude": to_st.lat,
            "longitude": to_st.lon,
            "arrive_time_iso": arrive_iso,
            "depart_time_iso": depart_iso,
            "eta_minutes_from_start": elapsed,
            "from_code": sec.from_code,
            "to_code": sec.to_code,
            "section_travel_time_min": travel_min,
            "halt_time_min_at_station": halt,
            "leg_type": sec.leg_type,
        })
        stop_index += 1

    # Optionally append to CSV
    gs.write_schedule(os.path.join(out_dir, "user_train_schedule.csv"), [gs.TrainStop(**s) for s in schedule])
    return {"schedule": schedule}


@app.post("/analyze-scenario")
def analyze_scenario(req: AnalyzeScenarioRequest) -> Dict[str, Any]:
    """Accept a simulator scenario JSON, compute conflicts and precedence, and return AI-style suggestions.
    If GEMINI_API_KEY is set, also return a natural-language analysis string under 'analysis'.
    """
    base_dir, sih_stations_csv, sih_sections_csv, trainsih_stations_csv, _ = _load_inputs()

    # Build augmented network using generator utilities (more coverage via kNN)
    merged_stations = gs.merge_stations(sih_stations_csv, trainsih_stations_csv)
    real_sections = gs.load_real_sections(sih_sections_csv)
    augmented_sections = gs.augment_sections_with_knn(merged_stations, real_sections, k=3, avg_speed_kmph=70.0)

    # Build name-based adjacency and travel-time map so UI station names work
    from collections import defaultdict, deque
    name_graph: Dict[str, list[str]] = defaultdict(list)
    edge_tt: Dict[tuple[str, str], float] = {}
    for sec in augmented_sections:
        u = sec.from_name
        v = sec.to_name
        if not u or not v:
            continue
        name_graph[u].append(v)
        edge_tt[(u, v)] = max(1.0, sec.travel_min)

    def shortest_path(start: str, end: str) -> list[str]:
        if start not in name_graph:
            return []
        q = deque([(start, [start])])
        seen = {start}
        while q:
            node, path = q.popleft()
            if node == end:
                return path
            for nb in name_graph.get(node, []):
                if nb not in seen:
                    seen.add(nb)
                    q.append((nb, path + [nb]))
        return []

    built_trains: list[SimTrain] = []
    for t in req.trains:
        route = shortest_path(t.source, t.destination)
        if not route:
            # no path; skip this train
            continue
        # priority mapping
        pr_map = {"High": 5, "Medium": 3, "Low": 1}
        pr = pr_map.get(t.priority_level, 1)
        # build occupancies along route
        current = 0.0
        occ: list[BlockOccupancy] = []
        for i in range(len(route) - 1):
            u = route[i]
            v = route[i + 1]
            travel = edge_tt.get((u, v), 5.0)
            occ.append(BlockOccupancy(block_id=f"{u}-{v}", start_time=current, end_time=current + travel))
            current += travel
        built_trains.append(
            SimTrain(
                train_id=t.train_id,
                category=t.train_type.lower(),
                priority=pr,
                planned_path=route,
                occupancies=occ,
                delay_minutes=0.0,
            )
        )

    # Detect conflicts and compute precedence actions
    conflicts = detect_block_conflicts(built_trains)
    id_pairs = {tuple(sorted((a, b))) for _, a, b, _ in conflicts}
    decisions = decide_precedence(list(id_pairs), {tr.train_id: tr for tr in built_trains})

    # Heuristic recommendations from conflicts/decisions
    recs: list[Dict[str, Any]] = []
    for blk, a, b, window in conflicts:
        key = f"{blk}:{a}:{b}:{window[0]:.1f}"
        winner = None
        action_a = decisions.get(a)
        action_b = decisions.get(b)
        if action_a == "PROCEED":
            winner = a
        elif action_b == "PROCEED":
            winner = b
        desc = f"Resolve block contention on {blk}: let {winner or a} proceed, hold the other"
        overlap_min = max(0.0, window[1] - window[0])
        impact = f"-{overlap_min:.0f} min potential delay"
        confidence = 80 if winner else 60
        recs.append({
            "id": key,
            "description": desc,
            "impact": impact,
            "confidence": confidence,
        })

    # Optional Gemini analysis summary
    analysis = None
    try:
        import requests as _rq
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key:
            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + api_key
            text_blob = {
                "contents": [{"parts": [{"text": f"Conflicts: {conflicts}\nDecisions: {decisions}\nProvide brief controller recommendations."}]}]
            }
            r = _rq.post(url, json=text_blob, timeout=12)
            if r.ok:
                data = r.json()
                analysis = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text")
                )
    except Exception:
        analysis = None

    # Build structured analysis covering requested items
    # 1) Analyze conflicts/decisions
    conf_summary = [
        {
            "block": blk,
            "trains": [a, b],
            "window_min": round(window[1] - window[0], 1),
            "decision": {
                a: decisions.get(a, "HOLD"),
                b: decisions.get(b, "HOLD"),
            },
        }
        for (blk, a, b, window) in conflicts
    ]
    # 2) Reasoning (priority/headway/contention)
    reasoning = "Decisions prioritize higher priority and delayed trains; headway maintained by holding the lower-scoring train on shared blocks."
    # 3) Rerouting/staggering suggestion
    rerouting = "Consider alternate paths to bypass congested blocks and stagger lower-priority departures by 2–5 minutes to restore headway."
    # 4) KPI impact (qualitative)
    kpi_impact = {
        "throughput": "neutral to slightly positive",
        "average_delay": "reduced for priority trains, small increase for held trains",
        "safety": "maintained via headway and single-block occupancy",
    }
    # 5) Short event log
    event_log = [
        f"t+{round(w[0],1)}: conflict on {blk} between {a} and {b}"
        for (blk, a, b, w) in conflicts
    ]
    # 6) Fairness check
    fairness = "Fair if priorities reflect service policy; rotate holds among equal-priority trains to avoid starvation."
    # 7) Optimization outline
    optimization = "Apply precedence + optional reroute for held trains; if conflict chain detected, schedule minor offsets to break cascades."

    analysis_struct = {
        "conflicts_and_decisions": conf_summary,
        "reasoning": reasoning,
        "rerouting_or_staggering": rerouting,
        "kpi_impact": kpi_impact,
        "event_log": event_log,
        "fairness": fairness,
        "optimization_strategy": optimization,
        "model_summary": analysis,
    }

    # Shape conflicts for UI
    ui_conflicts = [
        {
            "block": blk,
            "trainA": a,
            "trainB": b,
            "start": window[0],
            "end": window[1],
        }
        for (blk, a, b, window) in conflicts
    ]
    return {"recommendations": recs, "analysis": analysis, "analysis_struct": analysis_struct, "conflicts": ui_conflicts}


# Health
@app.get("/health")
def health():
    return {"status": "ok"}


