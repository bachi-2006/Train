import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Train, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap,
  Signal,
  Settings,
  Play,
  Pause,
  BarChart,
  Users,
  Lightbulb
} from 'lucide-react';

// Import new components
import ConflictChecker from './ConflictChecker';
import TrainScenarioBuilder from './TrainScenarioBuilder';
import PerformanceStats from './PerformanceStats';
import LearningCollaboration from './LearningCollaboration';

interface Train {
  id: string;
  name: string;
  position: number;
  speed: number;
  status: 'moving' | 'stopped' | 'delayed';
  destination: string;
}

interface Recommendation {
  id: string;
  type: 'priority' | 'hold' | 'route';
  description: string;
  explanation: string;
  impact: string;
  confidence: number;
}

interface TrainConflict {
  id: string;
  trainA: string;
  trainB: string;
  conflictPoint: string;
  timeToConflict: number;
  severity: 'high' | 'medium' | 'low';
  suggestedAction: string;
  registered?: boolean;
}

const TrainControlDashboard = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [confirmedConflicts, setConfirmedConflicts] = useState(new Set());
  const [trains, setTrains] = useState<Train[]>([
    { id: 'T001', name: 'Express Mumbai', position: 25, speed: 85, status: 'moving', destination: 'Mumbai Central' },
    { id: 'T002', name: 'Local Delhi', position: 60, speed: 45, status: 'delayed', destination: 'New Delhi' },
    { id: 'T003', name: 'Freight Cargo', position: 40, speed: 30, status: 'stopped', destination: 'Cargo Terminal' },
  ]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [analysisText, setAnalysisText] = useState<string>("");
  const [analysisStruct, setAnalysisStruct] = useState<any>(null);

  const kpis = {
    throughput: 156,
    avgDelay: 4.2,
    punctuality: 89.5,
    acceptanceRate: 76.3,
    safetyViolations: 0
  };

  // Conflicts state and handlers
  const [conflicts, setConflicts] = useState<TrainConflict[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function runSimulationBackend() {
    try {
      setLoading(true);
      const res = await fetch("http://127.0.0.1:8000/run-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num_trains: 10, start_time_iso: "2025-09-19T08:00:00" }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setSchedule(data.schedule || []);
      // Synthesize simple conflicts: if two different trains share same from->to block with overlapping time windows
      const items = Array.isArray(data.schedule) ? data.schedule : [];
      type Stop = { train_id: string; from_code: string; to_code: string; arrive_time_iso: string; depart_time_iso: string; };
      const legs: Array<{ key: string; train: string; start: number; end: number }> = [];
      const parseTs = (iso: string) => new Date(iso).getTime();
      const byTrain: Record<string, Stop[]> = {} as any;
      for (const s of items as Stop[]) {
        if (!s.train_id) continue;
        (byTrain[s.train_id] = byTrain[s.train_id] || []).push(s);
      }
      Object.entries(byTrain).forEach(([tid, stops]) => {
        for (const st of stops) {
          if (st.from_code && st.to_code && st.arrive_time_iso && st.depart_time_iso) {
            const key = `${st.from_code}->${st.to_code}`;
            const start = parseTs(st.arrive_time_iso);
            const end = parseTs(st.depart_time_iso);
            if (end > start) legs.push({ key, train: tid, start, end });
          }
        }
      });
      legs.sort((a, b) => a.start - b.start);
      const found: any[] = [];
      for (let i = 0; i < legs.length; i++) {
        for (let j = i + 1; j < legs.length; j++) {
          const A = legs[i];
          const B = legs[j];
          if (B.start > A.end) break;
          if (A.key === B.key && A.train !== B.train) {
            const overlapStart = Math.max(A.start, B.start);
            const overlapMin = Math.max(0, Math.round((Math.min(A.end, B.end) - overlapStart) / 60000));
            if (overlapMin > 0) {
              found.push({
                id: `${A.key}-${A.train}-${B.train}-${overlapStart}`,
                trainA: A.train,
                trainB: B.train,
                conflictPoint: A.key,
                timeToConflict: 0,
                severity: overlapMin >= 5 ? 'high' : overlapMin >= 2 ? 'medium' : 'low',
                suggestedAction: overlapMin >= 5 ? 'Hold lower-priority train for headway' : 'Reduce speed for minor deconfliction',
              });
            }
          }
        }
      }
      setConflicts(found);
      setIsSimulating(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleAddConflict = (conflict: TrainConflict) => {
    setConflicts(prev => [...prev, conflict]);
  };

  const handleRegisterConflict = (conflictId: string) => {
    setConflicts(prev => prev.map(conflict => 
      conflict.id === conflictId ? { ...conflict, registered: true } : conflict
    ));
  };

  // Simulate train movement
  useEffect(() => {
    if (!isSimulating) return;
    
    const interval = setInterval(() => {
      setTrains(prev => prev.map(train => ({
        ...train,
        position: train.status === 'moving' 
          ? Math.min(100, train.position + Math.random() * 2)
          : train.position
      })));
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Listen for backend AI recommendations from Simulator
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail || {};
      const recs = (detail.recommendations || []).map((r: any, idx: number) => ({
        id: r.id || `AR${idx}`,
        type: r.description?.toLowerCase().includes('hold') ? 'hold' : 'priority',
        description: r.description || 'Recommendation',
        explanation: detail.analysis || 'Heuristic recommendation based on conflict and precedence analysis.',
        impact: r.impact || '',
        confidence: r.confidence || 75,
      }));
      setRecommendations(recs);
      if (detail.analysis) setAnalysisText(detail.analysis);
      if (detail.analysis_struct) setAnalysisStruct(detail.analysis_struct);
      // Also populate conflicts panel from backend conflicts returned by analysis
      if (Array.isArray(detail.conflicts)) {
        const mapped = detail.conflicts.map((c: any, i: number) => {
          const overlapMin = Math.max(0, (c.end - c.start));
          const severity = overlapMin >= 5 ? 'high' : overlapMin >= 2 ? 'medium' : 'low';
          return {
            id: `${c.block}-${c.trainA}-${c.trainB}-${i}`,
            trainA: c.trainA,
            trainB: c.trainB,
            conflictPoint: c.block,
            timeToConflict: 0,
            severity,
            suggestedAction: severity === 'high' ? 'Hold lower-priority train for headway' : 'Reduce speed for minor deconfliction',
          };
        });
        setConflicts(mapped);
      }
    };
    window.addEventListener('ai-recommendations' as any, handler as any);
    return () => window.removeEventListener('ai-recommendations' as any, handler as any);
  }, []);

  const handleAcceptRecommendation = (id: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== id));
    // Here you would apply the recommendation logic
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'moving': return 'bg-success';
      case 'delayed': return 'bg-warning';
      case 'stopped': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border gradient-control p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Train className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-primary">RailWay AI Control</h1>
              <p className="text-sm text-muted-foreground">Smart India Hackathon - Train Traffic Optimizer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={isSimulating ? "destructive" : "default"}
              onClick={() => {
                if (isSimulating) {
                  setIsSimulating(false);
                } else {
                  runSimulationBackend();
                }
              }}
              className="flex items-center gap-2"
              disabled={loading}
            >
              {isSimulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isSimulating ? 'Stop' : (loading ? 'Running…' : 'Start')} Simulation
            </Button>
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="gradient-control border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary pulse-signal" />
                Throughput
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{kpis.throughput}</div>
              <p className="text-xs text-muted-foreground">trains/hour</p>
            </CardContent>
          </Card>

          <Card className="gradient-control border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                Avg Delay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{kpis.avgDelay}m</div>
              <p className="text-xs text-muted-foreground">minutes</p>
            </CardContent>
          </Card>

          <Card className="gradient-control border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Punctuality
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{kpis.punctuality}%</div>
              <p className="text-xs text-muted-foreground">on-time</p>
            </CardContent>
          </Card>

          <Card className="gradient-control border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" />
                AI Acceptance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{kpis.acceptanceRate}%</div>
              <p className="text-xs text-muted-foreground">accepted</p>
            </CardContent>
          </Card>

          <Card className="gradient-control border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-success" />
                Safety
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{kpis.safetyViolations}</div>
              <p className="text-xs text-muted-foreground">violations</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Signal className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Conflicts
            </TabsTrigger>
            <TabsTrigger value="simulator" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Simulator
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Learning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Track Visualization */}
          <Card className="lg:col-span-2 gradient-control border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Signal className="h-5 w-5 text-primary" />
                Station Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                {/* Map container */}
                <iframe
                  title="Station Map"
                  srcDoc={`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Station Map</title>
  <style>
    #map { height: 100%; width: 100%; }
    html, body { height: 100%; margin: 0; padding: 0; }
  </style>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([20.5937, 78.9629], 5); // Centered on India

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    var stations = [
      { name: "Hyderabad Deccan (Nampally)", lat: 17.3840, lon: 78.4676 },
      { name: "Kacheguda Junction", lat: 17.3849, lon: 78.5011 },
      { name: "Secunderabad Junction", lat: 17.4399, lon: 78.4983 },
      { name: "Vijayawada Junction", lat: 16.5182, lon: 80.6185 },
      { name: "Rajahmundry", lat: 17.0005, lon: 81.8040 },
      { name: "Samalkot Junction", lat: 17.0536, lon: 82.1762 },
      { name: "Visakhapatnam Junction", lat: 17.7221, lon: 83.3018 },
      { name: "Vizianagaram Junction", lat: 18.1164, lon: 83.4090 },
      { name: "Mumbai CSMT", lat: 18.9402, lon: 72.8356 },
      { name: "Kurnool Town", lat: 15.8337, lon: 78.0550 },
      { name: "New Delhi", lat: 28.6417, lon: 77.2197 },
      { name: "Howrah Junction", lat: 22.5850, lon: 88.3468 },
      { name: "Kanpur Central", lat: 26.4478, lon: 80.3506 },
      { name: "Patna Junction", lat: 25.6090, lon: 85.1415 },
      { name: "Kalyan Junction", lat: 19.2437, lon: 73.1305 },
      { name: "Prayagraj Junction", lat: 25.4358, lon: 81.8463 },
      { name: "Itarsi Junction", lat: 22.6148, lon: 77.7628 },
      { name: "Vadodara Junction", lat: 22.3102, lon: 73.1812 },
      { name: "Lucknow Charbagh", lat: 26.8300, lon: 80.9220 },
      { name: "Bhopal Junction", lat: 23.2547, lon: 77.4019 },
      { name: "Nagpur Junction", lat: 21.1500, lon: 79.0890 },
      { name: "Jaipur Junction", lat: 26.9270, lon: 75.7986 },
      { name: "Chennai Central", lat: 13.0820, lon: 80.2757 },
      { name: "Bangalore City", lat: 12.9766, lon: 77.5692 },
      { name: "Pune Junction", lat: 18.5286, lon: 73.8748 },
      { name: "Ahmedabad Junction", lat: 23.0268, lon: 72.6009 },
      { name: "Surat", lat: 21.1950, lon: 72.8367 },
      { name: "Varanasi Junction", lat: 25.3207, lon: 82.9873 },
      { name: "Agra Cantt", lat: 27.1605, lon: 78.0081 },
      { name: "Jhansi Junction", lat: 25.4486, lon: 78.5685 }
    ];

    stations.forEach(function(station) {
      L.marker([station.lat, station.lon]).addTo(map)
        .bindPopup(station.name);
    });
  </script>
</body>
</html>`}
                  style={{ border: 'none', height: '100%', width: '100%' }}
                />
              </div>
            </CardContent>
          </Card>

              {/* System Status */}
              <Card className="gradient-control border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                      <p className="text-lg font-medium">All Systems Operational</p>
                      <p className="text-sm text-muted-foreground">No active conflicts detected</p>
                      <div className="mt-4 p-3 bg-success/10 rounded-md">
                        <p className="text-sm text-success">AI recommendations available in Simulator tab</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          <TabsContent value="conflicts">
            <ConflictChecker 
              conflicts={conflicts} 
              onRegisterConflict={handleRegisterConflict} 
              onRunSimulator={() => setIsSimulating(true)} 
              isSimulating={isSimulating} 
              aiRecommendations={recommendations}
              onConfirmConflict={(conflictId) => setConfirmedConflicts(prev => new Set(prev).add(conflictId))}
              confirmedConflicts={confirmedConflicts}
              analysisText={analysisText}
              analysisStruct={analysisStruct}
            />
          </TabsContent>

          <TabsContent value="simulator">
            <TrainScenarioBuilder 
              onCreateConflict={handleAddConflict} 
              onEnter={() => setActiveTab("conflicts")} 
            />
          </TabsContent>

          <TabsContent value="analytics">
            <PerformanceStats isSimulating={isSimulating} />
          </TabsContent>

          <TabsContent value="learning">
            <LearningCollaboration />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TrainControlDashboard;
