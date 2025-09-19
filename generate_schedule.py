from __future__ import annotations

import csv
import math
import os
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Set


# -----------------------------
# Utilities
# -----------------------------


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def parse_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


# -----------------------------
# Data loading and merging
# -----------------------------


@dataclass
class Station:
    code: str
    name: str
    platform_count: int
    halt_min: float
    lat: Optional[float]
    lon: Optional[float]


@dataclass
class Section:
    from_code: str
    from_name: str
    to_code: str
    to_name: str
    distance_km: float
    travel_min: float
    leg_type: str  # "real" or "inferred"


def load_sih_stations(path: str) -> Dict[str, Station]:
    stations: Dict[str, Station] = {}
    if not os.path.exists(path):
        return stations
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (row.get("Station Code") or "").strip()
            name = (row.get("Station Name") or code).strip()
            platform = int(row.get("Platform Count", 0) or 0)
            halt = parse_float(row.get("Halt Time (mins)") or "0", 0.0)
            stations[code] = Station(code=code, name=name, platform_count=platform, halt_min=halt, lat=None, lon=None)
    return stations


def load_trainsih_stations(path: str) -> Dict[str, Station]:
    stations: Dict[str, Station] = {}
    if not os.path.exists(path):
        return stations
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (row.get("Station Code") or "").strip()
            name = (row.get("Station Name") or code).strip()
            platform = int(row.get("Platform Count", 0) or 0)
            halt = parse_float(row.get("Halt Time (mins)") or "0", 0.0)
            lat = row.get("Latitude")
            lon = row.get("Longitude")
            latf = parse_float(lat) if lat not in (None, "") else None
            lonf = parse_float(lon) if lon not in (None, "") else None
            # Deduplicate by code; prefer rows that include coordinates
            if code in stations:
                existing = stations[code]
                if (existing.lat is None or existing.lon is None) and (latf is not None and lonf is not None):
                    stations[code] = Station(code=code, name=name, platform_count=platform, halt_min=halt, lat=latf, lon=lonf)
            else:
                stations[code] = Station(code=code, name=name, platform_count=platform, halt_min=halt, lat=latf, lon=lonf)
    return stations


def merge_stations(sih_path: str, trainsih_path: str) -> Dict[str, Station]:
    sih = load_sih_stations(sih_path)
    trn = load_trainsih_stations(trainsih_path)
    merged: Dict[str, Station] = {}
    # start with Trainsih (has coords)
    merged.update(trn)
    # fill from SIH where missing data (halt/platform/name)
    for code, st in sih.items():
        if code in merged:
            m = merged[code]
            name = m.name or st.name
            platform = m.platform_count if m.platform_count else st.platform_count
            halt = m.halt_min if m.halt_min else st.halt_min
            merged[code] = Station(code=code, name=name, platform_count=platform, halt_min=halt, lat=m.lat, lon=m.lon)
        else:
            merged[code] = st
    return merged


def load_real_sections(path: str) -> List[Section]:
    sections: List[Section] = []
    if not os.path.exists(path):
        return sections
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fc = (row.get("From Station Code") or "").strip()
            fn = (row.get("From Station Name") or fc).strip()
            tc = (row.get("To Station Code") or "").strip()
            tn = (row.get("To Station Name") or tc).strip()
            dist = parse_float(row.get("Distance (km)") or "0", 0.0)
            tmin = parse_float(row.get("Average Travel Time (mins)") or "0", 0.0)
            if fc and tc and fc != tc:
                sections.append(Section(from_code=fc, from_name=fn, to_code=tc, to_name=tn, distance_km=dist, travel_min=tmin, leg_type="real"))
    return sections


# -----------------------------
# Graph augmentation
# -----------------------------


def augment_sections_with_knn(stations: Dict[str, Station], base_sections: List[Section], k: int = 3, avg_speed_kmph: float = 70.0) -> List[Section]:
    existing: Set[Tuple[str, str]] = {(s.from_code, s.to_code) for s in base_sections}
    result: List[Section] = list(base_sections)
    codes = list(stations.keys())
    for i, code in enumerate(codes):
        st = stations[code]
        if st.lat is None or st.lon is None:
            continue
        # compute distances
        dlist: List[Tuple[float, str]] = []
        for j, other_code in enumerate(codes):
            if other_code == code:
                continue
            ot = stations[other_code]
            if ot.lat is None or ot.lon is None:
                continue
            d = haversine_km(st.lat, st.lon, ot.lat, ot.lon)
            dlist.append((d, other_code))
        dlist.sort(key=lambda x: x[0])
        # connect to k nearest not already connected (both directions)
        added = 0
        for d, oc in dlist:
            if added >= k:
                break
            if (code, oc) in existing:
                continue
            # infer travel time
            travel_min = (d / avg_speed_kmph) * 60.0
            result.append(
                Section(
                    from_code=code,
                    from_name=stations[code].name,
                    to_code=oc,
                    to_name=stations[oc].name,
                    distance_km=d,
                    travel_min=travel_min,
                    leg_type="inferred",
                )
            )
            existing.add((code, oc))
            added += 1
    return result


def write_master_stations(path: str, stations: Dict[str, Station]) -> None:
    fieldnames = [
        "Station Code",
        "Station Name",
        "Platform Count",
        "Halt Time (mins)",
        "Latitude",
        "Longitude",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for code, st in stations.items():
            w.writerow(
                {
                    "Station Code": st.code,
                    "Station Name": st.name,
                    "Platform Count": st.platform_count,
                    "Halt Time (mins)": st.halt_min,
                    "Latitude": st.lat if st.lat is not None else "",
                    "Longitude": st.lon if st.lon is not None else "",
                }
            )


def write_augmented_sections(path: str, sections: List[Section]) -> None:
    fieldnames = [
        "From Station Code",
        "From Station Name",
        "To Station Code",
        "To Station Name",
        "Distance (km)",
        "Average Travel Time (mins)",
        "Leg Type",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for s in sections:
            w.writerow(
                {
                    "From Station Code": s.from_code,
                    "From Station Name": s.from_name,
                    "To Station Code": s.to_code,
                    "To Station Name": s.to_name,
                    "Distance (km)": round(s.distance_km, 3),
                    "Average Travel Time (mins)": round(s.travel_min, 1),
                    "Leg Type": s.leg_type,
                }
            )


# -----------------------------
# Train generation and schedule
# -----------------------------


@dataclass
class TrainStop:
    train_id: str
    train_name: str
    train_type: str
    priority_level: str
    stop_index: int
    station_code: str
    station_name: str
    latitude: Optional[float]
    longitude: Optional[float]
    arrive_time_iso: str
    depart_time_iso: str
    eta_minutes_from_start: float
    from_code: str
    to_code: str
    section_travel_time_min: float
    halt_time_min_at_station: float
    leg_type: str


def build_adjacency(sections: List[Section]) -> Dict[str, List[Tuple[str, Section]]]:
    adj: Dict[str, List[Tuple[str, Section]]] = {}
    for s in sections:
        adj.setdefault(s.from_code, []).append((s.to_code, s))
    return adj


def pick_route(adj: Dict[str, List[Tuple[str, Section]]], stations: Dict[str, Station], min_stops: int = 5, max_stops: int = 10) -> List[Section]:
    if not adj:
        return []
    start_code = random.choice(list(stations.keys()))
    # ensure start has outgoing
    attempts = 0
    while start_code not in adj and attempts < 50:
        start_code = random.choice(list(stations.keys()))
        attempts += 1
    if start_code not in adj:
        return []
    visited: Set[str] = {start_code}
    path_sections: List[Section] = []
    current = start_code
    target_len = random.randint(min_stops - 1, max_stops - 1)  # legs
    for _ in range(200):  # safety cap
        neighbors = [sec for nxt, sec in adj.get(current, []) if nxt not in visited]
        if not neighbors:
            break
        sec = random.choice(neighbors)
        path_sections.append(sec)
        visited.add(sec.to_code)
        current = sec.to_code
        if len(path_sections) >= target_len:
            break
    # ensure minimum
    if len(path_sections) < (min_stops - 1):
        return []
    return path_sections


def generate_trains_schedule(
    stations: Dict[str, Station],
    sections: List[Section],
    num_trains: int = 10,
    start_time_iso: str = "2025-09-19T08:00:00",
) -> List[TrainStop]:
    random.seed(42)
    adj = build_adjacency(sections)
    schedule: List[TrainStop] = []
    start_dt = datetime.fromisoformat(start_time_iso)
    train_types = ["Passenger", "Express", "Superfast", "Freight", "Special"]
    priorities = ["High", "Medium", "Low"]
    tcount = 0
    attempts = 0
    while tcount < num_trains and attempts < num_trains * 10:
        attempts += 1
        path_secs = pick_route(adj, stations, 5, 10)
        if not path_secs:
            continue
        tcount += 1
        tid = f"T{tcount:03d}"
        tname = f"Auto {tcount}"
        ttype = random.choice(train_types)
        prio = random.choice(priorities)
        # Build timeline
        elapsed = 0.0
        # first stop (origin)
        origin_code = path_secs[0].from_code
        origin = stations.get(origin_code)
        if origin is None:
            tcount -= 1
            continue
        arrive = start_dt
        depart = start_dt
        schedule.append(
            TrainStop(
                train_id=tid,
                train_name=tname,
                train_type=ttype,
                priority_level=prio,
                stop_index=0,
                station_code=origin.code,
                station_name=origin.name,
                latitude=origin.lat,
                longitude=origin.lon,
                arrive_time_iso=arrive.isoformat(),
                depart_time_iso=depart.isoformat(),
                eta_minutes_from_start=elapsed,
                from_code="",
                to_code=path_secs[0].to_code,
                section_travel_time_min=0.0,
                halt_time_min_at_station=origin.halt_min,
                leg_type="origin",
            )
        )
        stop_index = 1
        current_time = start_dt
        for sec in path_secs:
            # travel
            travel_min = max(1.0, sec.travel_min)
            current_time = current_time + timedelta(minutes=travel_min)
            elapsed += travel_min
            to_st = stations.get(sec.to_code)
            if to_st is None:
                continue
            arrive_iso = current_time.isoformat()
            # halt
            halt = max(0.0, to_st.halt_min)
            current_time = current_time + timedelta(minutes=halt)
            depart_iso = current_time.isoformat()
            elapsed += halt
            schedule.append(
                TrainStop(
                    train_id=tid,
                    train_name=tname,
                    train_type=ttype,
                    priority_level=prio,
                    stop_index=stop_index,
                    station_code=to_st.code,
                    station_name=to_st.name,
                    latitude=to_st.lat,
                    longitude=to_st.lon,
                    arrive_time_iso=arrive_iso,
                    depart_time_iso=depart_iso,
                    eta_minutes_from_start=elapsed,
                    from_code=sec.from_code,
                    to_code=sec.to_code,
                    section_travel_time_min=travel_min,
                    halt_time_min_at_station=halt,
                    leg_type=sec.leg_type,
                )
            )
            stop_index += 1
    return schedule


def write_schedule(path: str, schedule: List[TrainStop]) -> None:
    fieldnames = [
        "train_id",
        "train_name",
        "train_type",
        "priority_level",
        "stop_index",
        "station_code",
        "station_name",
        "latitude",
        "longitude",
        "arrive_time_iso",
        "depart_time_iso",
        "eta_minutes_from_start",
        "from_code",
        "to_code",
        "section_travel_time_min",
        "halt_time_min_at_station",
        "leg_type",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for s in schedule:
            w.writerow(
                {
                    "train_id": s.train_id,
                    "train_name": s.train_name,
                    "train_type": s.train_type,
                    "priority_level": s.priority_level,
                    "stop_index": s.stop_index,
                    "station_code": s.station_code,
                    "station_name": s.station_name,
                    "latitude": s.latitude if s.latitude is not None else "",
                    "longitude": s.longitude if s.longitude is not None else "",
                    "arrive_time_iso": s.arrive_time_iso,
                    "depart_time_iso": s.depart_time_iso,
                    "eta_minutes_from_start": round(s.eta_minutes_from_start, 1),
                    "from_code": s.from_code,
                    "to_code": s.to_code,
                    "section_travel_time_min": round(s.section_travel_time_min, 1),
                    "halt_time_min_at_station": round(s.halt_time_min_at_station, 1),
                    "leg_type": s.leg_type,
                }
            )


def main() -> None:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # Inputs
    sih_stations_csv = os.path.join(base_dir, "with connecting junction - with connecting junction.csv")
    sih_sections_csv = os.path.join(base_dir, "form every station to every station - form every station to every station.csv")
    trainsih_stations_csv = os.path.join(os.path.dirname(base_dir), "Trainsih", "add 20 more stations - add 20 more stations.csv")

    # Outputs
    out_dir = os.path.join(base_dir, "data")
    os.makedirs(out_dir, exist_ok=True)
    master_stations_csv = os.path.join(out_dir, "master_stations.csv")
    augmented_sections_csv = os.path.join(out_dir, "augmented_sections.csv")
    schedule_csv = os.path.join(out_dir, "train_schedule.csv")

    # Merge and augment
    merged_stations = merge_stations(sih_stations_csv, trainsih_stations_csv)
    real_sections = load_real_sections(sih_sections_csv)
    augmented_sections = augment_sections_with_knn(merged_stations, real_sections, k=3, avg_speed_kmph=70.0)

    # Generate schedule
    schedule = generate_trains_schedule(merged_stations, augmented_sections, num_trains=10, start_time_iso="2025-09-19T08:00:00")

    # Write outputs
    write_master_stations(master_stations_csv, merged_stations)
    write_augmented_sections(augmented_sections_csv, augmented_sections)
    write_schedule(schedule_csv, schedule)

    print("Generated:")
    print(master_stations_csv)
    print(augmented_sections_csv)
    print(schedule_csv)


if __name__ == "__main__":
    main()


