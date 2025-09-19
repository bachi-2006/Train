import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TrainScenarioBuilderProps {
  onEnter: () => void;
  onCreateConflict: (conflict: any) => void;
}

const stations = [
  'Hyderabad Deccan (Nampally)',
  'Kacheguda Junction',
  'Secunderabad Junction',
  'Vijayawada Junction',
  'Rajahmundry',
  'Samalkot Junction',
  'Visakhapatnam Junction',
  'Vizianagaram Junction',
  'Mumbai CSMT',
  'Kurnool Town',
  'New Delhi',
  'Howrah Junction',
  'Kanpur Central',
  'Patna Junction',
  'Kalyan Junction',
  'Prayagraj Junction',
  'Itarsi Junction',
  'Vadodara Junction',
  'Lucknow Charbagh',
  'Bhopal Junction',
  'Nagpur Junction',
  'Jaipur Junction',
  'Chennai Central',
  'Bangalore City',
  'Pune Junction',
  'Ahmedabad Junction',
  'Surat',
  'Varanasi Junction',
  'Agra Cantt',
  'Jhansi Junction'
];

const TrainScenarioBuilder: React.FC<TrainScenarioBuilderProps> = ({ onEnter, onCreateConflict }) => {
  // State for Train 1 Parameters
  const [train1, setTrain1] = React.useState({
    id: '',
    name: '',
    type: 'passenger',
    priority: 'medium',
    speed: '',
    length: '',
    departureTime: '',
    arrivalTime: '',
    source: '',
    destination: ''
  });

  // State for Train 2 Parameters
  const [train2, setTrain2] = React.useState({
    id: '',
    name: '',
    type: 'passenger',
    priority: 'medium',
    speed: '',
    length: '',
    departureTime: '',
    arrivalTime: '',
    source: '',
    destination: ''
  });

  // Handlers for input changes
  const handleTrain1Change = (field: string, value: any) => {
    setTrain1(prev => ({ ...prev, [field]: value }));
  };

  const handleTrain2Change = (field: string, value: any) => {
    setTrain2(prev => ({ ...prev, [field]: value }));
  };

  const handleEnter = async () => {
    try {
      // Build a simple user-defined train path from train1 source->destination
      const codes = [train1.source, train1.destination].filter(Boolean);
      if (codes.length < 2) {
        onEnter();
        return;
      }
      const res = await fetch('http://127.0.0.1:8000/add-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          train_id: train1.id || undefined,
          train_name: train1.name || undefined,
          train_type: (train1.type || 'passenger').toLowerCase() === 'freight' ? 'Freight' : 'Passenger',
          priority_level: (train1.priority || 'medium').charAt(0).toUpperCase() + (train1.priority || 'medium').slice(1),
          stations: codes, // server will infer legs
          start_time_iso: '2025-09-19T08:00:00'
        })
      });
      if (!res.ok) throw new Error('API error');
      // Now build a scenario JSON and ask backend for analysis/recommendations
      const scenario = {
        trains: [
          {
            train_id: train1.id || 'TUSER1',
            name: train1.name || 'User Train 1',
            train_type: (train1.type || 'passenger'),
            priority_level: (train1.priority || 'medium').charAt(0).toUpperCase() + (train1.priority || 'medium').slice(1),
            source: train1.source,
            destination: train1.destination,
          },
          ...(train2.source && train2.destination
            ? [
                {
                  train_id: train2.id || 'TUSER2',
                  name: train2.name || 'User Train 2',
                  train_type: (train2.type || 'passenger'),
                  priority_level: (train2.priority || 'medium').charAt(0).toUpperCase() + (train2.priority || 'medium').slice(1),
                  source: train2.source,
                  destination: train2.destination,
                },
              ]
            : []),
        ],
        constraints: { min_headway_min: 2.0 },
        simulation: { num_trains: 0 },
      };
      await fetch('http://127.0.0.1:8000/analyze-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario),
      })
        .then(r => r.json())
        .then(data => {
          // Surface recommendations via a custom event to dashboard
          const evt = new CustomEvent('ai-recommendations', { detail: data });
          window.dispatchEvent(evt);
        })
        .catch(() => {});
    } catch (e) {
      console.error(e);
    } finally {
      onEnter();
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Train Parameters - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Train 1 Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Train 1 Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="train1-id">Train ID</Label>
              <Input id="train1-id" value={train1.id} onChange={e => handleTrain1Change('id', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train1-name">Name</Label>
              <Input id="train1-name" value={train1.name} onChange={e => handleTrain1Change('name', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train1-type">Train Type</Label>
              <Select value={train1.type} onValueChange={value => handleTrain1Change('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passenger">Passenger</SelectItem>
                  <SelectItem value="vande-bharat">Vande Bharat</SelectItem>
                  <SelectItem value="freight">Freight</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="train1-priority">Priority Level of Train</Label>
              <Select value={train1.priority} onValueChange={value => handleTrain1Change('priority', value)}>
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
              <Label htmlFor="train1-speed">Speed</Label>
              <Input id="train1-speed" type="number" value={train1.speed} onChange={e => handleTrain1Change('speed', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train1-length">Length</Label>
              <Input id="train1-length" type="number" value={train1.length} onChange={e => handleTrain1Change('length', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train1-departureTime">Scheduled Departure</Label>
              <Input id="train1-departureTime" type="time" value={train1.departureTime} onChange={e => handleTrain1Change('departureTime', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train1-arrivalTime">Scheduled Arrival</Label>
              <Input id="train1-arrivalTime" type="time" value={train1.arrivalTime} onChange={e => handleTrain1Change('arrivalTime', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train1-source">Source</Label>
              <Select value={train1.source} onValueChange={value => handleTrain1Change('source', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(station => (
                    <SelectItem key={station} value={station}>{station}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="train1-destination">Destination</Label>
              <Select value={train1.destination} onValueChange={value => handleTrain1Change('destination', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(station => (
                    <SelectItem key={station} value={station}>{station}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Train 2 Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Train 2 Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="train2-id">Train ID</Label>
              <Input id="train2-id" value={train2.id} onChange={e => handleTrain2Change('id', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train2-name">Name</Label>
              <Input id="train2-name" value={train2.name} onChange={e => handleTrain2Change('name', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train2-type">Train Type</Label>
              <Select value={train2.type} onValueChange={value => handleTrain2Change('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passenger">Passenger</SelectItem>
                  <SelectItem value="vande-bharat">Vande Bharat</SelectItem>
                  <SelectItem value="freight">Freight</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="train2-priority">Priority Level of Train</Label>
              <Select value={train2.priority} onValueChange={value => handleTrain2Change('priority', value)}>
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
              <Label htmlFor="train2-speed">Speed</Label>
              <Input id="train2-speed" type="number" value={train2.speed} onChange={e => handleTrain2Change('speed', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train2-length">Length</Label>
              <Input id="train2-length" type="number" value={train2.length} onChange={e => handleTrain2Change('length', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train2-departureTime">Scheduled Departure</Label>
              <Input id="train2-departureTime" type="time" value={train2.departureTime} onChange={e => handleTrain2Change('departureTime', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train2-arrivalTime">Scheduled Arrival</Label>
              <Input id="train2-arrivalTime" type="time" value={train2.arrivalTime} onChange={e => handleTrain2Change('arrivalTime', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="train2-source">Source</Label>
              <Select value={train2.source} onValueChange={value => handleTrain2Change('source', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(station => (
                    <SelectItem key={station} value={station}>{station}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="train2-destination">Destination</Label>
              <Select value={train2.destination} onValueChange={value => handleTrain2Change('destination', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(station => (
                    <SelectItem key={station} value={station}>{station}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleEnter} className="w-32">
          Enter
        </Button>
      </div>
    </div>
  );
};

export default TrainScenarioBuilder;
