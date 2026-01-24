"use client";
import React, { useState, useMemo } from 'react';
import Map, { NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl';
import { Terminal, Wind, AlertTriangle, Play, Loader2, Activity, Zap, ChevronRight, Thermometer, Droplets, Mountain } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import 'mapbox-gl/dist/mapbox-gl.css';

const RAW_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN = RAW_TOKEN.replace(/"/g, ''); 

export default function IncidentCommander() {
  const [simParams, setSimParams] = useState({
    windSpeed: 50,
    windDir: 'N',
    moisture: 10,
    humidity: 25,     // NEW
    temperature: 85,  // NEW
    slope: 15,        // NEW
  });

  const [aiPrompt, setAiPrompt] = useState('');

  const heatmapLayer: any = {
    id: 'fire-heat',
    type: 'heatmap',
    paint: {
      'heatmap-weight': ['get', 'intensity'],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,0,0,0)',
        0.1, 'rgba(50,0,0,0.5)',
        0.3, 'rgb(100,0,0)',
        0.5, 'rgb(200,40,0)',
        0.8, 'rgb(255,140,0)',
        1,   'rgb(255,255,200)'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20, 15, 50],
      'heatmap-opacity': 0.85
    }
  };

  const mutation = useMutation({
    mutationFn: async (params: typeof simParams) => {
      const res = await fetch('http://127.0.0.1:8000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.json();
    },
  });

  const aiMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('http://127.0.0.1:8000/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text })
      });
      if (!res.ok) throw new Error("AI Uplink Failed");
      return res.json();
    },
    onSuccess: (data) => {
      // Update the sliders with the AI-parsed values
      setSimParams(data.params);
      // Auto-trigger the simulation with new parameters
      mutation.mutate(data.params);
      setAiPrompt('');
    }
  });

  const handleAICommand = () => {
    if (!aiPrompt.trim()) return;
    aiMutation.mutate(aiPrompt);
  };

  const fireData = useMemo(() => ({
    type: 'FeatureCollection',
    features: mutation.data?.data.map((point: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
      properties: { intensity: point.intensity }
    })) || []
  }), [mutation.data]);

  return (
    <main className="bg-[#0a0e1a] text-slate-200 font-sans selection:bg-orange-500/30" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <aside className="relative flex flex-col h-full bg-[#0B1121] border-r border-white/5 shadow-2xl z-20 overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-lg border border-orange-500/30">
              <AlertTriangle className="text-orange-500" size={22} />
            </div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">INCIDENT<br/><span className="text-orange-500">COMMANDER</span></h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Environmental Specs</label>
            
            {/* WIND SPEED */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
               <div className="flex justify-between text-xs mb-2"><span>Wind Velocity</span><span className="text-orange-400 font-mono">{simParams.windSpeed} MPH</span></div>
               <input type="range" min="0" max="100" value={simParams.windSpeed} onChange={(e) => setSimParams({...simParams, windSpeed: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-orange-500" />
            </div>

            {/* TEMPERATURE */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
               <div className="flex justify-between text-xs mb-2">
                 <span className="flex items-center gap-1"><Thermometer size={12}/> Temperature</span>
                 <span className="text-red-400 font-mono">{simParams.temperature}°F</span>
               </div>
               <input type="range" min="30" max="120" value={simParams.temperature} onChange={(e) => setSimParams({...simParams, temperature: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-red-500" />
            </div>

            {/* HUMIDITY */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
               <div className="flex justify-between text-xs mb-2">
                 <span className="flex items-center gap-1"><Droplets size={12}/> Humidity</span>
                 <span className="text-blue-400 font-mono">{simParams.humidity}%</span>
               </div>
               <input type="range" min="0" max="100" value={simParams.humidity} onChange={(e) => setSimParams({...simParams, humidity: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-blue-500" />
            </div>

            {/* SLOPE */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
               <div className="flex justify-between text-xs mb-2">
                 <span className="flex items-center gap-1"><Mountain size={12}/> Gradient Slope</span>
                 <span className="text-emerald-400 font-mono">{simParams.slope}°</span>
               </div>
               <input type="range" min="0" max="45" value={simParams.slope} onChange={(e) => setSimParams({...simParams, slope: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-emerald-500" />
            </div>
          </div>
        </div>

        {/* --- AI TERMINAL SECTION --- */}
        <div className="px-6 py-4 space-y-2 border-t border-white/5">
          <label className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Terminal size={12} /> AI Prompt
          </label>
          <div className="relative group bg-black/40 rounded-lg border border-purple-500/20 p-1">
            <textarea 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAICommand())}
              className="w-full bg-transparent p-3 text-xs text-slate-200 placeholder:text-slate-600 font-mono outline-none resize-none"
              placeholder="// Input natural language command..."
              rows={3}
            />
            <button 
              onClick={handleAICommand}
              disabled={aiMutation.isPending}
              className="absolute bottom-2 right-2 p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white transition-colors disabled:opacity-50"
            >
              {aiMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        <div className="p-6 mt-auto border-t border-white/10 bg-[#0f172a] relative z-20">
          <button onClick={() => mutation.mutate(simParams)} disabled={mutation.isPending} className="w-full bg-orange-600 p-4 rounded-lg font-bold flex items-center justify-center gap-3">
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Zap size={18} />}
            INITIATE SIMULATION
          </button>
        </div>
      </aside>

      <section className="relative h-full w-full bg-black z-10">
        <Map initialViewState={{ longitude: -121.5, latitude: 38.5, zoom: 9 }} style={{ width: '100%', height: '100%' }} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
          {mutation.data && <Source type="geojson" data={fireData as any}><Layer {...heatmapLayer} /></Source>}
          <NavigationControl position="top-right" />
        </Map>
      </section>
    </main>
  );
}