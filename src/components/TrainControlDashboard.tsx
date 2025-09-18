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

const TrainControlDashboard = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [trains, setTrains] = useState<Train[]>([
    { id: 'T001', name: 'Express Mumbai', position: 25, speed: 85, status: 'moving', destination: 'Mumbai Central' },
    { id: 'T002', name: 'Local Delhi', position: 60, speed: 45, status: 'delayed', destination: 'New Delhi' },
    { id: 'T003', name: 'Freight Cargo', position: 40, speed: 30, status: 'stopped', destination: 'Cargo Terminal' },
  ]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([
    {
      id: 'R001',
      type: 'priority',
      description: 'Give priority to Express Mumbai at Junction B',
      explanation: 'Express Mumbai is approaching Junction B with high passenger load (450+ passengers) and strict schedule adherence requirements. Current signal timing would cause 8-minute delay. Priority passage will maintain schedule while Local Delhi can absorb 3-minute delay with minimal passenger impact.',
      impact: '+12% throughput improvement',
      confidence: 94
    },
    {
      id: 'R002', 
      type: 'hold',
      description: 'Hold Local Delhi for 3 minutes to avoid conflict',
      explanation: 'Predictive analysis shows Local Delhi and Freight Cargo will create deadlock at Platform 2 in 4 minutes. Holding Local Delhi for 3 minutes allows Freight Cargo to clear the platform, preventing cascade delays across 3 downstream trains. Safety buffer maintained at 2.5 minutes headway.',
      impact: '-8 minutes total delay',
      confidence: 87
    }
  ]);

  const kpis = {
    throughput: 156,
    avgDelay: 4.2,
    punctuality: 89.5,
    acceptanceRate: 76.3,
    safetyViolations: 0
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
              onClick={() => setIsSimulating(!isSimulating)}
              className="flex items-center gap-2"
            >
              {isSimulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isSimulating ? 'Stop' : 'Start'} Simulation
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
        <Tabs defaultValue="overview" className="w-full">
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
                    Live Track Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {trains.map((train) => (
                      <div key={train.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Train className={`h-5 w-5 ${train.status === 'moving' ? 'train-moving text-primary' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="font-medium">{train.name}</p>
                              <p className="text-sm text-muted-foreground">→ {train.destination}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={train.status === 'moving' ? 'default' : train.status === 'delayed' ? 'secondary' : 'destructive'}>
                              {train.status}
                            </Badge>
                            <span className="text-sm font-mono">{train.speed} km/h</span>
                          </div>
                        </div>
                        <div className="relative">
                          <Progress value={train.position} className="h-3" />
                          <div 
                            className={`absolute top-0 h-3 w-3 rounded-full ${getStatusColor(train.status)} transition-smooth`}
                            style={{ left: `${train.position}%`, transform: 'translateX(-50%)' }}
                          />
                        </div>
                      </div>
                    ))}
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
            <ConflictChecker trains={trains} isSimulating={isSimulating} />
          </TabsContent>

          <TabsContent value="simulator">
            <TrainScenarioBuilder />
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