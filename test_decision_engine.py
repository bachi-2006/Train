from rail_decision_engine import (
    Train,
    BlockOccupancy,
    RailNetwork,
    Edge,
    detect_block_conflicts,
    decide_precedence,
    dijkstra_shortest_path,
    propagate_delay_simple,
    run_simulation,
    compute_kpis,
)


def scenario_conflict_and_precedence():
    t1 = Train(
        train_id="T1",
        category="passenger",
        priority=5,
        planned_path=["A", "B"],
        delay_minutes=10.0,
        occupancies=[BlockOccupancy("A-B", 0.0, 5.0)],
    )
    t2 = Train(
        train_id="T2",
        category="freight",
        priority=2,
        planned_path=["A", "B"],
        delay_minutes=0.0,
        occupancies=[BlockOccupancy("A-B", 3.0, 6.0)],
    )
    conflicts = detect_block_conflicts([t1, t2])
    decisions = decide_precedence([(t1.train_id, t2.train_id)], {"T1": t1, "T2": t2})
    return conflicts, decisions


def scenario_reroute():
    net = RailNetwork(
        nodes={"A", "B", "C", "D"},
        edges={
            "A": [Edge("A", "B", 10.0), Edge("A", "D", 6.0)],
            "B": [Edge("B", "C", 10.0)],
            "D": [Edge("D", "C", 7.0)],
        },
    )
    dist, path = dijkstra_shortest_path(net, "A", "C") or (None, None)
    return dist, path


def scenario_delay_and_sim_kpis():
    t1 = Train(
        train_id="EXP",
        category="passenger",
        priority=5,
        planned_path=["A", "B", "C"],
        delay_minutes=5.0,
        occupancies=[BlockOccupancy("B-C", 5.0, 10.0)],
    )
    t2 = Train(
        train_id="FRT",
        category="freight",
        priority=2,
        planned_path=["B", "C"],
        delay_minutes=0.0,
        occupancies=[BlockOccupancy("B-C", 6.0, 12.0)],
    )
    trains = [t1, t2]
    propagate_delay_simple(trains, added_delay_per_conflict=3.0)
    log = run_simulation(trains)
    kpis = compute_kpis(trains, log)
    return trains, log, kpis


def main():
    print("== Conflict & Precedence ==")
    conflicts, decisions = scenario_conflict_and_precedence()
    print("Conflicts:", conflicts)
    print("Decisions:", decisions)

    print("\n== Rerouting (Dijkstra) ==")
    dist, path = scenario_reroute()
    print("Distance:", dist)
    print("Path:", path)

    print("\n== Delay Propagation, Simulation, KPIs ==")
    trains, log, kpis = scenario_delay_and_sim_kpis()
    print("Delays:", {t.train_id: t.delay_minutes for t in trains})
    print("Sim log:")
    for line in log:
        print(line)
    print("KPIs:", kpis)


if __name__ == "__main__":
    main()


