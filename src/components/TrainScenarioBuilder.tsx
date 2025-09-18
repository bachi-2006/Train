import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Train, 
  Play, 
  Pause, 
  RotateCcw,
  Settings,
  AlertTriangle,
  CheckCircle,
  Zap,
  Clock,
  MapPin,
  Save,
  Download
} from 'lucide-react';

interface TrainScenario {
  id: string;
  name: string;
  type: 'passenger' | 'vande-bharat' | 'freight' | 'maintenance';
  priority: 'high' | 'medium' | 'low';
  speed: number;
  departureTime: string;
  origin: string;
  destination: string;
  position: number;
  status: 'moving' | 'stopped' | 'delayed' | 'conflict';
}

interface TrackSection {
  id: string;
  name: string;
  type: 'single' | 'double';
  length: number;
  maintenance: boolean;
  capacity: number;
  occupiedBy: string[];
}

interface Junction {
  id: string;
  name: string;
  capacity: number;
  platforms: number;
  connectedTracks: string[];
}

interface Recommendation {
  id: string;
  type: 'priority' | 'hold' | 'route';
  description: string;
  explanation: string;
  impact: string;
  confidence: number;
  steps: string[];
  alternativeSolution?: string;
}

const TrainScenarioBuilder = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [activeTab, setActiveTab] = useState('scenarios');

  const [trains, setTrains] = useState<TrainScenario[]>([
    {
      id: 'T001',
      name: 'Express Mumbai',
      type: 'vande-bharat',
      priority: 'high',
      speed: 85,
      departureTime: '14:30',
      origin: 'Platform A',
      destination: 'Junction B',
      position: 25,
      status: 'moving'
    }
  ]);

  const [tracks, setTracks] = useState<TrackSection[]>([
    {
      id: 'TRACK001',
      name: 'Main Line A-B',
      type: 'double',
      length: 100,
      maintenance: false,
      capacity: 2,
      occupiedBy: ['T001']
    }
  ]);

  const [junctions, setJunctions] = useState<Junction[]>([
    {
      id: 'JUN001',
      name: 'Junction B',
      capacity: 3,
      platforms: 2,
      connectedTracks: ['TRACK001', 'TRACK002']
    }
  ]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([
    {
      id: 'R001',
      type: 'priority',
      description: 'Give priority to Express Mumbai at Junction B',
      explanation: 'Express Mumbai is approaching Junction B with high passenger load (450+ passengers) and strict schedule adherence requirements. Current signal timing would cause 8-minute delay.',
      impact: '+12% throughput improvement',
      confidence: 94,
      steps: [
        '1. Hold Local Delhi for 3 minutes at Platform 1',
        '2. Clear Junction B for Express Mumbai',
        '3. Signal green for Express Mumbai approach',
        '4. Resume Local Delhi after Express Mumbai passes'
      ],
      alternativeSolution: 'Reroute Express Mumbai via alternate track (adds 2 min but reduces overall delay)'
    }
  ]);

  const [newTrain, setNewTrain] = useState<Partial<TrainScenario>>({
    type: 'passenger',
    priority: 'medium',
    speed: 60,
    departureTime: '15:00',
    origin: 'Platform A',
    destination: 'Platform B'
  });

  const [conflictDetected, setConflictDetected] = useState(false);

  // Detect conflicts
  useEffect(() => {
    const conflicts = tracks.some(track => track.occupiedBy.length > track.capacity);
    setConflictDetected(conflicts);
  }, [trains, tracks]);

  // Simulate train movement
  useEffect(() => {
    if (!isSimulating) return;
    
    const interval = setInterval(() => {
      setTrains(prev => prev.map(train => ({
        ...train,
        position: train.status === 'moving' 
          ? Math.min(100, train.position + Math.random() * 2 * simulationSpeed)
          : train.position
      })));
    }, 1000 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isSimulating, simulationSpeed]);

  const addTrain = () => {
    if (newTrain.name && newTrain.type) {
      const train: TrainScenario = {
        id: `T${String(trains.length + 1).padStart(3, '0')}`,
        name: newTrain.name!,
        type: newTrain.type as any,
        priority: newTrain.priority as any,
        speed: newTrain.speed || 60,
        departureTime: newTrain.departureTime || '15:00',
        origin: newTrain.origin || 'Platform A',
        destination: newTrain.destination || 'Platform B',
        position: 0,
        status: 'stopped'
      };
      setTrains(prev => [...prev, train]);
      setNewTrain({ type: 'passenger', priority: 'medium', speed: 60, departureTime: '15:00' });
    }
  };

  const getTrainIcon = (type: string) => {
    switch (type) {
      case 'passenger': return '🚆';
      case 'vande-bharat': return '🚄';
      case 'freight': return '🚚';
      case 'maintenance': return '🚧';
      default: return '🚂';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      case 'low': return 'text-muted-foreground';
      default: return 'text-muted-foreground';
    }
  };

  const handleAcceptRecommendation = (id: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== id));
  };

  const exportScenario = () => {
    const scenario = {
      trains,
      tracks,
      junctions,
      recommendations,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `train-scenario-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Simulation Controls */}
      <Card className="gradient-control border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Simulation Controls
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isSimulating ? "destructive" : "default"}
                onClick={() => setIsSimulating(!isSimulating)}
                size="sm"
              >
                {isSimulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isSimulating ? 'Pause' : 'Play'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTrains(prev => prev.map(t => ({ ...t, position: 0, status: 'stopped' as const })))}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Select value={String(simulationSpeed)} onValueChange={(value) => setSimulationSpeed(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="5">5x</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Conflict Alert */}
      {conflictDetected && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Conflict Detected! Multiple trains on same track.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scenarios">Train Scenarios</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="conflicts">Conflict Builder</TabsTrigger>
          <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
          <TabsTrigger value="visualization">Live View</TabsTrigger>
        </TabsList>

        {/* Train Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-4">
          <Card className="gradient-control border-border">
            <CardHeader>
              <CardTitle>Add New Train Scenario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trainName">Train Name</Label>
                  <Input
                    id="trainName"
                    placeholder="Enter train name"
                    value={newTrain.name || ''}
                    onChange={(e) => setNewTrain(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="trainType">Train Type</Label>
                  <Select value={newTrain.type} onValueChange={(value) => setNewTrain(prev => ({ ...prev, type: value as any }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passenger">🚆 Passenger</SelectItem>
                      <SelectItem value="vande-bharat">🚄 Vande Bharat</SelectItem>
                      <SelectItem value="freight">🚚 Freight</SelectItem>
                      <SelectItem value="maintenance">🚧 Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newTrain.priority} onValueChange={(value) => setNewTrain(prev => ({ ...prev, priority: value as any }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="speed">Speed (km/h)</Label>
                  <Input
                    id="speed"
                    type="number"
                    value={newTrain.speed || 60}
                    onChange={(e) => setNewTrain(prev => ({ ...prev, speed: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="departureTime">Departure Time</Label>
                  <Input
                    id="departureTime"
                    type="time"
                    value={newTrain.departureTime || '15:00'}
                    onChange={(e) => setNewTrain(prev => ({ ...prev, departureTime: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="origin">Origin</Label>
                  <Input
                    id="origin"
                    placeholder="Platform A"
                    value={newTrain.origin || ''}
                    onChange={(e) => setNewTrain(prev => ({ ...prev, origin: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={addTrain} className="w-full">Add Train</Button>
            </CardContent>
          </Card>

          {/* Current Trains */}
          <Card className="gradient-control border-border">
            <CardHeader>
              <CardTitle>Current Train Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trains.map(train => (
                  <div key={train.id} className="p-3 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getTrainIcon(train.type)}</span>
                        <div>
                          <p className="font-medium">{train.name}</p>
                          <p className="text-sm text-muted-foreground">{train.origin} → {train.destination}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={getPriorityColor(train.priority)}>
                          {train.priority}
                        </Badge>
                        <span className="text-sm">{train.speed} km/h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card className="gradient-control border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent pulse-signal" />
                AI-Powered Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                    <p>All systems optimal - No recommendations needed</p>
                  </div>
                ) : (
                  recommendations.map((rec) => (
                    <div key={rec.id} className="p-4 border border-border rounded-lg bg-card/50">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-accent border-accent">
                            {rec.type.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{rec.confidence}% confidence</span>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium mb-2">{rec.description}</p>
                          <div className="p-3 bg-muted/30 rounded-md border-l-4 border-accent">
                            <p className="text-xs text-muted-foreground mb-1 font-medium">AI Reasoning:</p>
                            <p className="text-xs text-foreground leading-relaxed">{rec.explanation}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Optimized Solution Steps:</p>
                          <div className="space-y-1">
                            {rec.steps.map((step, index) => (
                              <div key={index} className="text-xs text-foreground flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                                  {index + 1}
                                </div>
                                {step}
                              </div>
                            ))}
                          </div>
                        </div>

                        {rec.alternativeSolution && (
                          <div className="p-2 bg-accent/10 rounded text-xs text-accent">
                            <span className="font-medium">Alternative: </span>{rec.alternativeSolution}
                          </div>
                        )}

                        <p className="text-xs text-success font-medium">{rec.impact}</p>
                        
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleAcceptRecommendation(rec.id)}
                            className="flex-1 bg-success hover:bg-success/90"
                          >
                            Accept Solution
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleAcceptRecommendation(rec.id)}
                            className="flex-1"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visualization Tab */}
        <TabsContent value="visualization" className="space-y-4">
          <Card className="gradient-control border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Live Train Movement Visualization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trains.map((train) => (
                  <div key={train.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getTrainIcon(train.type)}</span>
                        <div>
                          <p className="font-medium">{train.name}</p>
                          <p className="text-sm text-muted-foreground">→ {train.destination}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={train.status === 'conflict' ? 'destructive' : train.status === 'moving' ? 'default' : 'secondary'}>
                          {train.status}
                        </Badge>
                        <span className="text-sm font-mono">{train.speed} km/h</span>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress value={train.position} className="h-4" />
                      <div 
                        className={`absolute top-0 h-4 w-4 rounded-full ${train.status === 'conflict' ? 'bg-destructive' : train.status === 'moving' ? 'bg-primary' : 'bg-warning'} transition-smooth`}
                        style={{ left: `${train.position}%`, transform: 'translateX(-50%)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Export Controls */}
          <Card className="gradient-control border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="h-5 w-5 text-accent" />
                Export & Save
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button onClick={exportScenario} variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export Scenario
                </Button>
                <Button variant="outline" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save for Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs content placeholders */}
        <TabsContent value="infrastructure">
          <Card className="gradient-control border-border">
            <CardHeader>
              <CardTitle>Track & Junction Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Infrastructure configuration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts">
          <Card className="gradient-control border-border">
            <CardHeader>
              <CardTitle>Conflict Scenario Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Conflict builder coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrainScenarioBuilder;
