"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Map, { NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl';
import { Clock, Crosshair } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const RAW_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN = RAW_TOKEN.replace(/"/g, ''); 

export function MapView({ data, simParams, currentTime, setCurrentTime }: any) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const geoJSON = useMemo(() => {
    if (!data) return null;
    const activePoints = data.filter((p: any) => p.time <= currentTime);
    return {
      type: 'FeatureCollection',
      features: activePoints.map((point: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
        properties: { intensity: point.intensity }
      }))
    };
  }, [data, currentTime]);

  return (
    <div className="h-full w-full relative bg-black">
      <Map
        initialViewState={{ longitude: -121.5, latitude: 38.5, zoom: 11 }}
        style={{ width: '100%', height: '100%' }} // <--- THIS IS CRITICAL
        mapStyle="mapbox://styles/mapbox/dark-v11" // Try 'streets-v12' if dark doesn't load
        mapboxAccessToken={MAPBOX_TOKEN}
        attributionControl={false}
      >
        {geoJSON && (
           <Source type="geojson" data={geoJSON as any}>
             <Layer 
               id="fire-heat"
               type="heatmap"
               paint={{
                 'heatmap-weight': ['get', 'intensity'],
                 'heatmap-intensity': 1,
                 'heatmap-color': [
                   'interpolate', ['linear'], ['heatmap-density'],
                   0, 'rgba(0,0,0,0)',
                   0.2, 'rgba(200,50,0,0.4)',
                   0.4, 'rgb(220,70,0)',
                   0.6, 'rgb(255,140,0)',
                   0.8, 'rgb(255,200,0)',
                   1, 'rgb(255,255,220)'
                 ],
                 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 10, 15, 30],
                 'heatmap-opacity': 0.85
               }}
             />
           </Source>
        )}
      </Map>

      {/* --- HUD --- */}
      <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/50 p-4 rounded-md shadow-2xl w-48">
           <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
             <Clock size={10} /> Mission Clock
           </div>
           <div className="font-mono text-xl text-white font-bold tracking-tight">
             {now ? now.toLocaleTimeString('en-US', { hour12: false }) : "00:00:00"}
           </div>
        </div>
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-700/50 p-3 rounded-md shadow-2xl w-48 flex items-center gap-3">
           <Crosshair className="text-cyan-500" size={16} />
           <div className="font-mono text-xs font-bold text-slate-300">
             38.5000°N <br/> 121.5000°W
           </div>
        </div>
      </div>

      {/* Timeline Slider */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[500px] bg-slate-950/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-xl shadow-2xl z-10">
         <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-3 font-mono">
            <span>T-0</span>
            <span className="text-orange-500">
               ELAPSED: {currentTime} MIN / {simParams.duration} MIN
            </span>
            <span>END</span>
         </div>
         <input 
            type="range" 
            min="0" 
            max={simParams.duration} 
            value={currentTime} 
            onChange={(e) => setCurrentTime(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
         />
      </div>
    </div>
  );
}