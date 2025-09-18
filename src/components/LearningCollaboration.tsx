import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, MessageSquare, ThumbsUp, Star, Clock } from 'lucide-react';

interface Experience {
  id: string;
  author: string;
  scenario: string;
  solution: string;
  outcome: string;
  rating: number;
  timestamp: string;
  tags: string[];
}

interface SimilarSolution {
  id: string;
  scenario: string;
  solution: string;
  successRate: number;
  lastUsed: string;
}

const LearningCollaboration = () => {
  const [experiences] = useState<Experience[]>([
    {
      id: 'E001',
      author: 'Controller A. Kumar',
      scenario: 'Heavy fog causing 15min delays on Express routes',
      solution: 'Implemented gradual speed reduction protocol with 3min headway buffer. Diverted 2 freight trains to alternate tracks.',
      outcome: 'Reduced overall delay from 45min to 18min. Zero safety incidents.',
      rating: 4.8,
      timestamp: '2 hours ago',
      tags: ['weather', 'delay-management', 'safety']
    },
    {
      id: 'E002',
      author: 'Controller R. Singh',
      scenario: 'Signal failure at Junction C during peak hours',
      solution: 'Activated manual signaling with 5min safety buffer. Coordinated with maintenance for 12min repair window.',
      outcome: 'Maintained 85% punctuality during crisis. Repair completed ahead of schedule.',
      rating: 4.6,
      timestamp: '1 day ago',
      tags: ['technical-failure', 'emergency', 'coordination']
    }
  ]);

  const [similarSolutions] = useState<SimilarSolution[]>([
    {
      id: 'S001',
      scenario: 'Freight train breakdown blocking main line',
      solution: 'Emergency rerouting through secondary branch + speed optimization',
      successRate: 92,
      lastUsed: '3 days ago'
    },
    {
      id: 'S002',
      scenario: 'Platform congestion during festival season',
      solution: 'Dynamic platform allocation with real-time passenger flow analysis',
      successRate: 87,
      lastUsed: '1 week ago'
    }
  ]);

  const [newExperience, setNewExperience] = useState({
    scenario: '',
    solution: '',
    outcome: '',
    tags: ''
  });

  const [selectedScenario, setSelectedScenario] = useState('');

  const handleSubmitExperience = () => {
    // In a real app, this would submit to backend
    console.log('Submitting experience:', newExperience);
    setNewExperience({ scenario: '', solution: '', outcome: '', tags: '' });
  };

  return (
    <div className="space-y-4">
      {/* Knowledge Sharing */}
      <Card className="gradient-control border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-accent" />
            Share Your Experience
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Scenario Type</label>
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scenario type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weather">Weather Conditions</SelectItem>
                  <SelectItem value="breakdown">Equipment Breakdown</SelectItem>
                  <SelectItem value="congestion">Traffic Congestion</SelectItem>
                  <SelectItem value="emergency">Emergency Situation</SelectItem>
                  <SelectItem value="maintenance">Scheduled Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Problem Description</label>
              <Textarea 
                placeholder="Describe the situation you encountered..."
                value={newExperience.scenario}
                onChange={(e) => setNewExperience(prev => ({ ...prev, scenario: e.target.value }))}
                className="h-20"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Solution Applied</label>
              <Textarea 
                placeholder="What steps did you take to resolve it?"
                value={newExperience.solution}
                onChange={(e) => setNewExperience(prev => ({ ...prev, solution: e.target.value }))}
                className="h-20"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Outcome & Results</label>
              <Textarea 
                placeholder="What was the result? Any metrics or lessons learned?"
                value={newExperience.outcome}
                onChange={(e) => setNewExperience(prev => ({ ...prev, outcome: e.target.value }))}
                className="h-16"
              />
            </div>

            <Button onClick={handleSubmitExperience} className="w-full">
              Share Experience
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Similar Solutions */}
      <Card className="gradient-control border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Similar Solutions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {similarSolutions.map((solution) => (
              <div key={solution.id} className="p-3 border border-border rounded-lg bg-card/50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-sm">{solution.scenario}</h4>
                  <Badge variant="outline" className="text-success border-success">
                    {solution.successRate}% success
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{solution.solution}</p>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last used: {solution.lastUsed}
                  </span>
                  <Button size="sm" variant="outline">Apply Similar</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Community Experiences */}
      <Card className="gradient-control border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-warning" />
            Community Experiences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {experiences.map((exp) => (
              <div key={exp.id} className="p-4 border border-border rounded-lg bg-card/50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{exp.author}</h4>
                    <p className="text-xs text-muted-foreground">{exp.timestamp}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-warning fill-warning" />
                    <span className="text-sm">{exp.rating}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">SCENARIO:</span>
                    <p className="text-sm">{exp.scenario}</p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-muted-foreground">SOLUTION:</span>
                    <p className="text-sm">{exp.solution}</p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-muted-foreground">OUTCOME:</span>
                    <p className="text-sm text-success">{exp.outcome}</p>
                  </div>

                  <div className="flex gap-1 flex-wrap">
                    {exp.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      Helpful
                    </Button>
                    <Button size="sm" variant="outline">
                      Try Similar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LearningCollaboration;