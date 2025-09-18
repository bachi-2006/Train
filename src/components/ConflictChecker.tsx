import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Route, Clock } from 'lucide-react';

interface TrainConflict {
  id: string;
  trainA: string;
  trainB: string;
  conflictPoint: string;
  timeToConflict: number;
  severity: 'high' | 'medium' | 'low';
  suggestedAction: string;
}

interface ConflictCheckerProps {
  trains: any[];
  isSimulating: boolean;
}

const ConflictChecker: React.FC<ConflictCheckerProps> = ({ trains, isSimulating }) => {
  const [conflicts, setConflicts] = useState<TrainConflict[]>([
    {
      id: 'C001',
      trainA: 'Express Mumbai',
      trainB: 'Local Delhi',
      conflictPoint: 'Junction B',
      timeToConflict: 4.2,
      severity: 'high',
      suggestedAction: 'Hold Local Delhi for 3 minutes'
    },
    {
      id: 'C002',
      trainA: 'Freight Cargo',
      trainB: 'Local Delhi',
      conflictPoint: 'Platform 2',
      timeToConflict: 8.5,
      severity: 'medium',
      suggestedAction: 'Reroute Freight to Platform 3'
    }
  ]);

  const [resolvedConflicts, setResolvedConflicts] = useState(0);

  useEffect(() => {
    if (!isSimulating) return;
    
    const interval = setInterval(() => {
      setConflicts(prev => prev.map(conflict => ({
        ...conflict,
        timeToConflict: Math.max(0, conflict.timeToConflict - 0.1)
      })).filter(conflict => conflict.timeToConflict > 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleResolveConflict = (id: string) => {
    setConflicts(prev => prev.filter(c => c.id !== id));
    setResolvedConflicts(prev => prev + 1);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card className="gradient-control border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Conflict Detection System
        </CardTitle>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-destructive">Active: {conflicts.length}</span>
          <span className="text-success">Resolved: {resolvedConflicts}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {conflicts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
              <p>No conflicts detected</p>
              <p className="text-xs">All tracks clear</p>
            </div>
          ) : (
            conflicts.map((conflict) => (
              <div key={conflict.id} className="p-3 border border-border rounded-lg bg-card/50">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant={getSeverityColor(conflict.severity)}>
                    {conflict.severity.toUpperCase()} PRIORITY
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {conflict.timeToConflict.toFixed(1)}min
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Route className="h-4 w-4 text-warning" />
                    <span className="font-medium">{conflict.trainA}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="font-medium">{conflict.trainB}</span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Conflict at: <span className="font-medium text-foreground">{conflict.conflictPoint}</span>
                  </p>
                  
                  <div className="p-2 bg-muted/30 rounded text-xs">
                    <span className="text-accent font-medium">Suggested Action: </span>
                    {conflict.suggestedAction}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleResolveConflict(conflict.id)}
                      className="flex-1 bg-success hover:bg-success/90"
                    >
                      Apply Solution
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      Override
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConflictChecker;