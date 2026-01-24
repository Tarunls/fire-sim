"use client";
import React, { useState } from 'react';
import Map, { NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl';
import { Terminal, Wind, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function IncidentCommander() {
  const [simParams, setSimParams] = useState({
    windSpeed: 50,
    windDir: 'N', // North wind pushes fire South
    moisture: 10,
  });

  const [aiPrompt, setAiPrompt] = useState('');

  // 1. THE HPC BRIDGE: Connect to Python Backend
  const mutation = useMutation({
    mutationFn: async (params: typeof simParams) => {
      // Note: Using 127.0.0.1 is safer than localhost on Windows
      const res = await fetch('http://127.0.0.1:8000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.json();
    }
  });

  // 2. THE AI BRIDGE: Connect to Python AI Parser
  const aiMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('http://127.0.0.1:8000/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text })
      });
      return res.json();
    }
  });

  const handleAICommand = () => {
     aiMutation.mutate(aiPrompt, {
        onSuccess: (data) => {
            setSimParams(data.params); // Update sliders
            mutation.mutate(data.params); // Run sim immediately
            setAiPrompt(''); // Clear box
        }
     });
  };

  // 3. VISUALIZATION LOGIC (GeoJSON)
  const fireData = {
    type: 'FeatureCollection',
    features: mutation.data?.data.map((point: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
      properties: { intensity: point.intensity }
    })) || []
  };

  const heatmapLayer: any = {
    id: 'fire-heat',
    type: 'heatmap',
    paint: {
      'heatmap-weight': 1,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(33,102,172,0)',
        0.2, 'rgb(103,169,207)',
        0.4, 'rgb(209,229,240)',
        0.6, 'rgb(253,219,199)',
        0.8, 'rgb(239,138,98)',
        1, 'rgb(178,24,43)'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20], 
    }
  };

  return (
    <main className="flex h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col shadow-xl z-20">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={20} />
            FIRE_SIM_COMMAND
          </h1>
          <div className="flex items-center gap-2 mt-2">
             <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
             <span className="text-xs font-mono text-slate-400">CLUSTER: ONLINE</span>
          </div>
        </div>

        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          {/* Environment Controls */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Wind size={14} /> Wind Speed ({simParams.windSpeed} mph)
            </h2>
            <input 
              type="range" min="0" max="100" 
              value={simParams.windSpeed}
              onChange={(e) => setSimParams({...simParams, windSpeed: parseInt(e.target.value)})}
              className="w-full h-1 bg-slate-700 rounded-lg cursor-pointer accent-orange-500"
            />
          </div>

          {/* AI Input */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Terminal size={14} /> AI Assistant
            </h2>
            <div className="space-y-2">
                <textarea 
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAICommand(); }}}
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none resize-none font-mono"
                rows={3}
                placeholder="e.g. 'Strong North winds'..."
                />
                <button 
                    onClick={handleAICommand}
                    disabled={aiMutation.isPending}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-xs py-2 rounded text-cyan-400 border border-slate-700 transition-colors uppercase tracking-wider"
                >
                    {aiMutation.isPending ? 'PARSING...' : 'EXECUTE AGENT COMMAND'}
                </button>
                {aiMutation.data && (
                    <p className="text-[10px] text-green-400 font-mono mt-2 border-l-2 border-green-500 pl-2">
                        {">"} {aiMutation.data.ai_response}
                    </p>
                )}
            </div>
          </div>
        </div>

        <div className="p-4 mt-auto border-t border-slate-800">
          <button 
            onClick={() => mutation.mutate(simParams)}
            disabled={mutation.isPending}
            className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 text-white py-3 rounded font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Play size={16} fill="currentColor" />}
            {mutation.isPending ? 'CALCULATING...' : 'RUN SIMULATION'}
          </button>
        </div>
      </aside>

      {/* MAP */}
      <section className="flex-1 relative bg-black">
        <Map
          initialViewState={{ longitude: -121.5, latitude: 38.5, zoom: 10 }}
          style={{width: '100%', height: '100%'}}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          {/* THE FIRE LAYER - This is what you were missing! */}
          {mutation.data && (
            <Source type="geojson" data={fireData as any}>
              <Layer {...heatmapLayer} />
            </Source>
          )}
          
          <NavigationControl position="top-right" showCompass={false} />
          <ScaleControl position="bottom-right" />
        </Map>
      </section>
    </main>
  );
}