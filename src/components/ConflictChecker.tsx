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
  registered?: boolean;
}

interface AIRecommendation {
  id: string;
  description: string;
  impact: string;
  confidence: number;
}

interface ConflictCheckerProps {
  conflicts: TrainConflict[];
  onRegisterConflict: (conflictId: string) => void;
  onRunSimulator: () => void;
  isSimulating: boolean;
  aiRecommendations: AIRecommendation[];
  onConfirmConflict: (conflictId: string) => void;
  confirmedConflicts: Set<string>;
  analysisText?: string;
  analysisStruct?: any;
}

const ConflictChecker: React.FC<ConflictCheckerProps> = ({ conflicts, onRegisterConflict, onRunSimulator, isSimulating, aiRecommendations, onConfirmConflict, confirmedConflicts, analysisText, analysisStruct }) => {
  const [resolvedConflicts, setResolvedConflicts] = useState(0);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const allRegistered = conflicts.length > 0 && conflicts.every(c => c.registered);

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
                    {!conflict.registered ? (
                      <Button 
                        size="sm" 
                        onClick={() => onRegisterConflict(conflict.id)}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        Register Conflict
                      </Button>
                    ) : !confirmedConflicts.has(conflict.id) ? (
                      <Button
                        size="sm"
                        onClick={() => onConfirmConflict(conflict.id)}
                        className="flex-1 bg-warning hover:bg-warning/90"
                      >
                        Confirm Registration
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        disabled
                        className="flex-1 bg-success"
                      >
                        Confirmed
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1">
                      Override
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          {allRegistered && (
            <div className="mt-4 flex justify-center">
              <Button onClick={onRunSimulator} className="w-48">
                Run Simulator
              </Button>
            </div>
          )}

          {aiRecommendations.length > 0 && (
            <div className="mt-6 p-4 border border-border rounded-lg bg-card/50">
              <h3 className="text-lg font-semibold mb-2">AI Recommendations</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                {aiRecommendations.map(rec => (
                  <li key={rec.id}>
                    <span className="font-medium">{rec.description}</span> - Impact: {rec.impact} (Confidence: {rec.confidence}%)
                  </li>
                ))}
              </ul>
              {analysisText && (
                <div className="mt-4 p-3 bg-muted/30 rounded text-sm whitespace-pre-wrap">
                  {analysisText}
                </div>
              )}
              {analysisStruct && (
                <div className="mt-4 p-3 bg-muted/30 rounded text-sm">
                  <div className="font-medium mb-1">Detailed Analysis</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs font-semibold">Conflicts & Decisions</div>
                      <ul className="list-disc list-inside text-xs">
                        {(analysisStruct.conflicts_and_decisions || []).map((c: any, i: number) => (
                          <li key={i}>{c.block}: {c.trains?.join(' vs ')} → {JSON.stringify(c.decision)}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-xs"><span className="font-semibold">Reasoning:</span> {analysisStruct.reasoning}</div>
                    <div className="text-xs"><span className="font-semibold">Rerouting/Staggering:</span> {analysisStruct.rerouting_or_staggering}</div>
                    <div className="text-xs"><span className="font-semibold">KPI impact:</span> throughput {analysisStruct.kpi_impact?.throughput}, delay {analysisStruct.kpi_impact?.average_delay}, safety {analysisStruct.kpi_impact?.safety}</div>
                    <div>
                      <div className="text-xs font-semibold">Event log</div>
                      <ul className="list-disc list-inside text-xs">
                        {(analysisStruct.event_log || []).map((l: string, i: number) => (<li key={i}>{l}</li>))}
                      </ul>
                    </div>
                    <div className="text-xs"><span className="font-semibold">Fairness:</span> {analysisStruct.fairness}</div>
                    <div className="text-xs"><span className="font-semibold">Optimization:</span> {analysisStruct.optimization_strategy}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConflictChecker;
