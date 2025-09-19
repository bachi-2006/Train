from __future__ import annotations

import csv
from typing import List
from scenario_schema import StationInput, TrackSectionInput


def load_stations_from_csv(csv_path: str) -> List[StationInput]:
    stations: List[StationInput] = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Expected columns: Station Code,Station Name,Platform Count,Track Availability,Halt Time (mins)
            code = row.get("Station Code") or row.get("code") or ""
            name = row.get("Station Name") or code
            platform_count = int(row.get("Platform Count", 0) or 0)
            halt_time_str = row.get("Halt Time (mins)") or row.get("halt") or "0"
            try:
                halt_time = float(halt_time_str)
            except ValueError:
                halt_time = 0.0
            stations.append(
                StationInput(
                    station_id=name,
                    platform_count=platform_count,
                    platform_length_m=600.0,
                    halt_time_min=halt_time,
                    station_priority="major_junction" if platform_count >= 8 else "small_station",
                )
            )
    return stations


def load_sections_from_csv(csv_path: str) -> List[TrackSectionInput]:
    sections: List[TrackSectionInput] = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        # Expected columns: From Station Code, From Station Name, To Station Code, To Station Name, Distance (km), Average Travel Time (mins)
        for row in reader:
            from_name = row.get("From Station Name") or row.get("from") or row.get("from_name") or ""
            to_name = row.get("To Station Name") or row.get("to") or row.get("to_name") or ""
            if not from_name or not to_name:
                continue
            travel_time_str = row.get("Average Travel Time (mins)") or row.get("avg_time") or row.get("travel_time_min") or "0"
            try:
                travel_time_min = float(travel_time_str)
            except ValueError:
                travel_time_min = 0.0
            sections.append(
                TrackSectionInput(
                    from_node=from_name,
                    to_node=to_name,
                    travel_time_min=travel_time_min,
                    availability="single",
                    section_capacity=1,
                    signalling="Automatic Block",
                )
            )
    return sections




