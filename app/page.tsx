"use client";
import React, { useState } from 'react';
import Map, { NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl';
import { Terminal, Wind, AlertTriangle, Play, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import 'mapbox-gl/dist/mapbox-gl.css';

// SANITIZE TOKEN
const RAW_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN = RAW_TOKEN.replace(/"/g, ''); 

export default function IncidentCommander() {
  const [simParams, setSimParams] = useState({
    windSpeed: 50,
    windDir: 'N',
    moisture: 10,
  });

  const [aiPrompt, setAiPrompt] = useState('');


  const heatmapLayer: any = {
    id: 'fire-heat',
    type: 'heatmap',
    paint: {
      // 1. INTENSITY: Use the 'intensity' prop from Python (0.0 to 1.0)
      'heatmap-weight': ['get', 'intensity'],

      // 2. COLOR RAMP: The "Inferno" Palette
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)',       // Transparent
        0.1, 'rgba(50,0,0,0.5)',  // Smoke (Dark edges)
        0.3, 'rgb(100,0,0)',      // Charred/Deep Red
        0.5, 'rgb(200,40,0)',     // Active Fire (Red-Orange)
        0.8, 'rgb(255,140,0)',    // Intense Fire (Bright Orange)
        1,   'rgb(255,255,200)'   // The Core (White-Hot)
      ],

      // 3. RADIUS: Smooths the dots into a blob
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, 2,  // Zoomed out: small dots
        9, 20, // Zoomed in: large merging blobs
        15, 50 // Ultra zoom: massive spread
      ],
      
      'heatmap-opacity': 0.85
    }
  };

  // --- BACKEND CONNECTIONS ---
  const mutation = useMutation({
    mutationFn: async (params: typeof simParams) => {
      const res = await fetch('http://127.0.0.1:8000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.json();
    }
  });

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
            setSimParams(data.params);
            mutation.mutate(data.params);
            setAiPrompt('');
        }
     });
  };

  // --- VISUALIZATION ---
  const fireData = {
    type: 'FeatureCollection',
    features: mutation.data?.data.map((point: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
      properties: { intensity: point.intensity }
    })) || []
  };

  const circleLayer: any = {
    id: 'fire-points',
    type: 'circle',
    paint: {
      'circle-radius': 8,
      'circle-color': '#00FF00', // NEON GREEN
      'circle-opacity': 0.8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  };

  return (
    // ⚠️ THE FIX: CSS GRID LAYOUT (320px Sidebar | Remainder Map)
    <main 
      style={{ 
        display: 'grid', 
        gridTemplateColumns: '320px 1fr', 
        height: '100vh', 
        width: '100vw', 
        overflow: 'hidden',
        backgroundColor: '#0f172a' 
      }}
    >
      
      {/* 1. SIDEBAR (Left Column) */}
      <aside className="bg-slate-950 border-r border-slate-800 flex flex-col shadow-xl z-20 h-full overflow-hidden relative">
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
          {/* Controls */}
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

      {/* 2. MAP AREA (Right Column) */}
      <section className="relative h-full w-full bg-black">
        
        {!MAPBOX_TOKEN && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black text-red-500 font-mono">
              ERROR: MAPBOX TOKEN MISSING
           </div>
        )}

        <Map
          initialViewState={{ longitude: -121.5, latitude: 38.5, zoom: 9 }}
          // ⚠️ FORCE WIDTH/HEIGHT
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        >
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