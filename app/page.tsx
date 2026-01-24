"use client";
import React, { useState } from 'react';
import Map, { NavigationControl, ScaleControl, Marker } from 'react-map-gl';
import { Terminal, Wind, Zap, AlertTriangle, Play, Map as MapIcon, Layers } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';


const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function IncidentCommander() {
  // Practical state for the simulation parameters
  const [simParams, setSimParams] = useState({
    windSpeed: 15,
    windDir: 'NW',
    moisture: 12,
    simDuration: 4
  });

  const [isSimulating, setIsSimulating] = useState(false);

  return (
    <main className="flex h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
      
      {/* SIDEBAR: CONTROLS (Fixed width, high utility) */}
      <aside className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col shadow-xl z-20">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={20} />
            FIRE_SIM_COMMAND
          </h1>
          <div className="flex items-center gap-2 mt-2">
             <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
             <span className="text-xs font-mono text-slate-400">CLUSTER: ONLINE (128 NODES)</span>
          </div>
        </div>

        {/* Manual Controls */}
        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
          
          {/* Section: Environment */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Wind size={14} /> Environmental Inputs
            </h2>
            <div className="space-y-4 bg-slate-900 p-3 rounded border border-slate-800">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Wind Speed (mph)</label>
                <input 
                  type="range" min="0" max="100" 
                  value={simParams.windSpeed}
                  onChange={(e) => setSimParams({...simParams, windSpeed: parseInt(e.target.value)})}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs font-mono mt-1">
                  <span>0</span>
                  <span className="text-blue-400">{simParams.windSpeed} MPH</span>
                  <span>100</span>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 block mb-1">Fuel Moisture (%)</label>
                 <input 
                  type="range" min="0" max="100" 
                  value={simParams.moisture}
                  onChange={(e) => setSimParams({...simParams, moisture: parseInt(e.target.value)})}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs font-mono mt-1">
                  <span>DRY</span>
                  <span className="text-blue-400">{simParams.moisture}%</span>
                  <span>WET</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: AI Commander */}
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Terminal size={14} /> AI Assistant
            </h2>
            <textarea 
              className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none resize-none font-mono"
              rows={4}
              placeholder="Describe scenario shift..."
            />
             <button className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-xs py-2 rounded text-slate-300 border border-slate-700 transition-colors">
              PARSE PARAMETERS
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <button 
            onClick={() => setIsSimulating(!isSimulating)}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded font-bold text-sm tracking-wide transition-colors ${
              isSimulating 
              ? 'bg-red-900/50 text-red-200 border border-red-700' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
            }`}
          >
            {isSimulating ? 'STOP SIMULATION' : 'RUN PREDICTION MODEL'}
            {!isSimulating && <Play size={16} fill="currentColor" />}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT: MAP */}
      <section className="flex-1 relative bg-black">
        <Map
          initialViewState={{
            longitude: -121.5, // California (General)
            latitude: 38.5,
            zoom: 9,
          }}
          style={{width: '100%', height: '100%'}}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          <NavigationControl position="top-right" showCompass={false} />
          <ScaleControl position="bottom-right" />
        </Map>

        {/* OVERLAY: Essential Data Only */}
        <div className="absolute top-4 left-4 bg-slate-950/90 backdrop-blur border border-slate-800 p-3 rounded shadow-2xl">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-bold">Risk Level</p>
              <p className="text-xl font-bold text-red-500">CRITICAL</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-bold">Est. Spread Rate</p>
              <p className="text-xl font-bold text-white">45 <span className="text-sm text-slate-400 font-normal">ac/hr</span></p>
            </div>
          </div>
        </div>
        
      </section>
    </main>
  );
}