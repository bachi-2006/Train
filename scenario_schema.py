from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class TrainInput:
    train_id: str
    name: Optional[str] = None
    train_type: str = "Passenger"  # Passenger, Freight, Express, Superfast, Mail, Special, Local/EMU
    priority_level: str = "Medium"  # High, Medium, Low
    speed_kmph: float = 0.0
    length_m: float = 0.0
    sched_departure: str = ""  # ISO time or HH:MM
    sched_arrival: str = ""    # ISO time or HH:MM
    source: str = ""
    destination: str = ""
    route_path: List[str] = None  # type: ignore
    alternative_route_path: Optional[List[str]] = None


@dataclass
class TrackSectionInput:
    from_node: str
    to_node: str
    travel_time_min: float
    availability: str = "single"  # single, double, loop
    section_capacity: int = 1
    signalling: str = "Automatic Block"  # Automatic Block, Manual Block, CTC


@dataclass
class StationInput:
    station_id: str
    platform_count: int
    platform_length_m: float
    halt_time_min: float
    station_priority: str  # major_junction, small_station, halt


@dataclass
class ConstraintsInput:
    min_headway_min: float = 2.0
    allow_overtake: bool = True
    crossing_rule: str = "passenger_first"  # e.g., passenger_first, delay_first
    track_conflict_rule: str = "single_line_opposite_forbidden"  # single_line_opposite_forbidden


@dataclass
class SimulationInput:
    simulation_speed: str = "realtime"  # realtime, fast, slow
    num_trains: int = 0
    scenario_type: str = "normal"  # normal, congestion, emergency, festival
    optimization_goal: str = "prioritize_passenger"  # minimize_delay, maximize_throughput, prioritize_passenger, balance


@dataclass
class Scenario:
    trains: List[TrainInput]
    sections: List[TrackSectionInput]
    stations: List[StationInput]
    constraints: ConstraintsInput
    simulation: SimulationInput


def priority_value(level: str) -> int:
    m = {"High": 5, "Medium": 3, "Low": 1}
    return m.get(level, 1)


