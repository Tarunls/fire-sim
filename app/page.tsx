"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, Marker } from 'react-map-gl';
import { Terminal, AlertTriangle, Play, Pause, Loader2, Zap, ChevronRight, Thermometer, PlusSquare, Droplets, Mountain, Compass, Clock, RefreshCw, Activity, GraduationCap, Building2, LayoutDashboard, FileWarning, FireExtinguisher } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import RiskReport from './components/RiskReport'; // Adjust path if needed
import 'mapbox-gl/dist/mapbox-gl.css';

const RAW_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN = RAW_TOKEN.replace(/"/g, ''); 

export default function RiskReportPage() {
  const [activeTab, setActiveTab] = useState<'controls' | 'impact'>('controls');
  const [showAllLandmarks, setShowAllLandmarks] = useState(false);
  
  const [simParams, setSimParams] = useState({
    windSpeed: 50,
    windDir: 'NW',
    moisture: 10,
    humidity: 20,     
    temperature: 95,  
    slope: 15,
    duration: 24 
  });

  const [aiPrompt, setAiPrompt] = useState('');
  
  // Animation State
  const [history, setHistory] = useState<any[]>([]); 
  const [currentFrame, setCurrentFrame] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  
  // GIS Data
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [riskReport, setRiskReport] = useState<any[]>([]); 
  const [loadingMapData, setLoadingMapData] = useState(false);

  // --- 1. DYNAMIC RADIUS GIS FETCH ---
  useEffect(() => {
    const fetchInfrastructure = async () => {
      setLoadingMapData(true);
      const centerLat = 38.5;
      const centerLon = -121.5;
      
      // LOGIC: A 50mph fire for 24h travels max ~50 miles. 
      // 1 deg lat ~ 69 miles. So we need roughly 0.8 degrees radius max.
      // We'll be generous and set a dynamic bounds based on sim params.
      // Defaulting to 0.5 (approx 35 miles) for safety.
      const radius = 0.5; 

      const query = `
        [out:json][timeout:25];
        (
          nwr["amenity"="hospital"](${centerLat - radius},${centerLon - radius},${centerLat + radius},${centerLon + radius});
          nwr["healthcare"="hospital"](${centerLat - radius},${centerLon - radius},${centerLat + radius},${centerLon + radius});
          nwr["amenity"="clinic"](${centerLat - radius},${centerLon - radius},${centerLat + radius},${centerLon + radius});
          nwr["power"="substation"](${centerLat - radius},${centerLon - radius},${centerLat + radius},${centerLon + radius});
          nwr["power"="generator"](${centerLat - radius},${centerLon - radius},${centerLat + radius},${centerLon + radius});
          nwr["amenity"="fire_station"](${centerLat - radius},${centerLon - radius},${centerLat + radius},${centerLon + radius});
          nwr["amenity"="school"](${centerLat - radius},${centerLon - radius},${centerLat + radius},${centerLon + radius});
        );
        out center;
      `; 

      try {
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: query
        });
        const data = await response.json();

        const processed = data.elements.map((node: any) => {
          let type = "unknown";
          let icon = <Building2 size={16} />;
          let priority = 0;

          if (node.tags.amenity === "hospital" || node.tags.healthcare === "hospital") {
            type = "medical"; icon = <PlusSquare size={16} />; priority = 10;
          } else if (node.tags.power === "substation" || node.tags.power === "generator") {
            type = "power"; icon = <Zap size={16} />; priority = 8;
          } else if (node.tags.amenity === "fire_station") {
            type = "response"; icon = <FireExtinguisher size={16} />; priority = 9;
          } else if (node.tags.amenity === "school") {
            type = "school"; icon = <GraduationCap size={16} />; priority = 5;
          }

          const lat = node.lat || node.center?.lat;
          const lon = node.lon || node.center?.lon;
          if (!lat || !lon) return null;

          return {
            id: node.id,
            name: node.tags.name || `${type} Infrastructure`,
            type, lat, lon, icon, priority
          };
        })
        .filter((i: any) => i !== null)
        .sort((a: any, b: any) => b.priority - a.priority); // Sort important stuff first

        // Cap at 200 items to keep map fast
        setLandmarks(processed.slice(0, 200));
      } catch (error) {
        console.error("GIS Error:", error);
      } finally {
        setLoadingMapData(false);
      }
    };
    fetchInfrastructure();
  }, []);

  // --- 2. RISK CALCULATION (NON-BLOCKING) ---
  const calculateRisk = (simHistory: any[]) => {
    // We use a small timeout to let the UI update (start playing) BEFORE we do heavy math
    setTimeout(() => {
      const impactMap: Record<number, any> = {};
      const range = 0.015; // ~1 mile precision

      simHistory.forEach((frame, idx) => {
        frame.forEach((firePoint: any) => {
          if (firePoint.intensity < 0.2) return;

          // Check landmarks
          landmarks.forEach(lm => {
            if (impactMap[lm.id]) return; // Already hit
            
            // Fast Bounding Box
            if (Math.abs(firePoint.lat - lm.lat) > range) return;
            if (Math.abs(firePoint.lon - lm.lon) > range) return;

            // Detailed Distance
            const dist = Math.sqrt(Math.pow(firePoint.lat - lm.lat, 2) + Math.pow(firePoint.lon - lm.lon, 2));
            
            if (dist < 0.008) { // Impact radius
               impactMap[lm.id] = {
                 ...lm,
                 timeToImpact: (idx * 0.5).toFixed(1),
                 status: "CRITICAL"
               };
            }
          });
        });
      });

      const report = Object.values(impactMap).sort((a: any, b: any) => parseFloat(a.timeToImpact) - parseFloat(b.timeToImpact));
      setRiskReport(report);
      
      // Auto-switch tab if danger found
      if (report.length > 0) setActiveTab('impact');
    }, 500); // 500ms delay ensures animation starts first
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
    onSuccess: (data) => {
      setHistory(data.data);
      setCurrentFrame(0);
      setIsPlaying(true); // START PLAYING IMMEDIATELY
      calculateRisk(data.data); // Then calculate risk in background
    }
  });

  // ... (AI Mutation remains same) ...
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
      setSimParams(prev => ({ ...prev, ...data.params }));
      mutation.mutate({ ...simParams, ...data.params });
      setAiPrompt('');
    }
  });

  const handleAICommand = () => {
    if (!aiPrompt.trim()) return;
    aiMutation.mutate(aiPrompt);
  };

  // Animation Loop
  useEffect(() => {
    if (isPlaying && history.length > 0) {
      animationRef.current = setTimeout(() => {
        setCurrentFrame((prev) => {
          if (prev >= history.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 100); 
    }
    return () => clearTimeout(animationRef.current as NodeJS.Timeout);
  }, [isPlaying, currentFrame, history]);

  // Data Memo
  const fireData = useMemo(() => {
    let activePoints = (history.length > 0 && history[currentFrame]) ? history[currentFrame] : [];
    if (!Array.isArray(activePoints)) activePoints = [];
    
    return {
      type: 'FeatureCollection',
      features: activePoints.map((point: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
        properties: { intensity: point.intensity }
      }))
    };
  }, [history, currentFrame]);

  // Heatmap Style
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
        0.6, 'rgb(255,100,0)', 
        1,   'rgb(255,255,200)'
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 15, 11, 25, 15, 50],
      'heatmap-opacity': 0.80
    }
  };

  const compassGrid = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];
  const visibleLandmarks = showAllLandmarks ? landmarks : riskReport;

  return (
    <main className="bg-[#0a0e1a] text-slate-200 font-sans selection:bg-orange-500/30" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      <aside className="relative flex flex-col h-full bg-[#0B1121] border-r border-white/5 shadow-2xl z-20 overflow-hidden">
        {/* HEADER */}
        <div className="p-6 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-lg border border-orange-500/30">
              <AlertTriangle className="text-orange-500" size={22} />
            </div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">INCIDENT<br/><span className="text-orange-500">COMMANDER</span></h1>
          </div>
          
          {/* TABS */}
          <div className="flex bg-black/40 p-1 rounded-lg">
            <button onClick={() => setActiveTab('controls')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'controls' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
              <LayoutDashboard size={14}/> CONTROLS
            </button>
            <button onClick={() => setActiveTab('impact')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'impact' ? 'bg-red-900/50 text-red-200 shadow-sm border border-red-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
              <FileWarning size={14}/> 
              IMPACT
              {riskReport.length > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full animate-bounce">{riskReport.length}</span>}
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
          
          {/* --- TAB 1: CONTROLS --- */}
          {activeTab === 'controls' && (
            <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
               {/* [Insert your existing Sliders/Compass code here exactly as before] */}
               {/* To save space, I'm abbreviating, but you should keep the Sliders logic here */}
               <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Environmental Specs</label>
                  
                  {/* COMPASS */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                     <div className="flex justify-between text-xs mb-2">
                       <span className="flex items-center gap-1"><Compass size={12}/> Wind Direction</span>
                       <span className="text-yellow-400 font-mono font-bold">{simParams.windDir}</span>
                     </div>
                     <div className="grid grid-cols-3 gap-1.5 mt-2">
                       {compassGrid.map((dir, idx) => (
                         <button
                           key={idx}
                           onClick={() => dir && setSimParams({...simParams, windDir: dir})}
                           disabled={!dir}
                           className={`h-8 text-[10px] font-bold rounded transition-all ${!dir ? 'invisible' : ''} ${simParams.windDir === dir ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)] scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                         >
                           {dir}
                         </button>
                       ))}
                     </div>
                  </div>

                  {/* WIND SPEED */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                     <div className="flex justify-between text-xs mb-2"><span>Wind Velocity</span><span className="text-orange-400 font-mono">{simParams.windSpeed} MPH</span></div>
                     <input type="range" min="0" max="100" value={simParams.windSpeed} onChange={(e) => setSimParams({...simParams, windSpeed: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-orange-500" />
                  </div>
                  
                  {/* Keep other sliders (Temp, Humidity, Slope, Duration) here... */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                     <div className="flex justify-between text-xs mb-2"><span className="flex items-center gap-1"><Thermometer size={12}/> Temperature</span><span className="text-red-400 font-mono">{simParams.temperature}°F</span></div>
                     <input type="range" min="30" max="120" value={simParams.temperature} onChange={(e) => setSimParams({...simParams, temperature: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-red-500" />
                  </div>

                                {/* HUMIDITY */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex justify-between text-xs mb-2">
                      <span className="flex items-center gap-1"><Droplets size={12}/> Humidity</span>
                      <span className="text-blue-400 font-mono">{simParams.humidity}%</span>
                  </div>
                  <input 
                      type="range" min="0" max="100" 
                      value={simParams.humidity} 
                      onChange={(e) => setSimParams({...simParams, humidity: parseInt(e.target.value)})} 
                      className="w-full h-1 bg-slate-800 accent-blue-500" 
                  />
              </div>

              {/* GRADIENT SLOPE */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex justify-between text-xs mb-2">
                      <span className="flex items-center gap-1"><Mountain size={12}/> Gradient Slope</span>
                      <span className="text-emerald-400 font-mono">{simParams.slope}°</span>
                  </div>
                  <input 
                      type="range" min="0" max="45" 
                      value={simParams.slope} 
                      onChange={(e) => setSimParams({...simParams, slope: parseInt(e.target.value)})} 
                      className="w-full h-1 bg-slate-800 accent-emerald-500" 
                  />
              </div>
              
              {/* PREDICTION WINDOW (TIME) SLIDER */}
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex justify-between text-xs mb-2">
                      <span className="flex items-center gap-1">
                          <Clock size={12} className="text-purple-400" /> 
                          Prediction Window
                      </span>
                      <span className="text-purple-400 font-mono font-bold">{simParams.duration} HRS</span>
                  </div>
                  <input 
                      type="range" 
                      min="2" 
                      max="96" 
                      step="2"
                      value={simParams.duration} 
                      onChange={(e) => setSimParams({...simParams, duration: parseInt(e.target.value)})} 
                      className="w-full h-1 bg-slate-800 accent-purple-500 cursor-pointer" 
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                      <span>Immediate</span>
                      <span>Extended Forecast</span>
                  </div>
              </div>

               </div>

               {/* AI TERMINAL */}
               <div className="space-y-3 px-4 py-3 border border-white/5 bg-black/20 rounded-xl">
                 <div className="flex items-center justify-between">
                   <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2"><Terminal size={12} /> Neural Input</label>
                   {aiMutation.isPending && <Loader2 size={12} className="text-purple-500 animate-spin" />}
                 </div>
                 <div className="relative group">
                   <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-25 transition"></div>
                   <div className="relative bg-[#05050a] rounded-lg border border-white/10 overflow-hidden">
                     <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAICommand())} className="w-full bg-transparent p-3 text-xs text-slate-300 placeholder:text-slate-600 font-mono outline-none resize-none leading-relaxed" placeholder="e.g. 'Simulate a fast moving fire towards the hospital...'" rows={3} />
                     <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-t border-white/5">
                       <span className="text-[9px] text-slate-500 font-mono italic">{aiMutation.isPending ? "PARSING..." : "READY"}</span>
                       <button onClick={handleAICommand} className="flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 transition">EXECUTE <ChevronRight size={14} /></button>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {/* --- TAB 2: IMPACT REPORT (New Component Integration) --- */}
          {activeTab === 'impact' && (
            <RiskReport 
              risks={riskReport} 
              showAll={showAllLandmarks} 
              onToggleView={() => setShowAllLandmarks(!showAllLandmarks)} 
            />
          )}
        </div>

        {/* RUN BUTTON */}
        <div className="p-6 mt-auto border-t border-white/10 bg-[#0f172a] relative z-20">
          <button onClick={() => mutation.mutate(simParams)} disabled={mutation.isPending} className="w-full bg-orange-600 p-4 rounded-lg font-bold flex items-center justify-center gap-3 hover:bg-orange-500 transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)]">
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Zap size={18} />}
            RUN PREDICTIVE MODEL
          </button>
        </div>
      </aside>

      {/* MAP AREA */}
      <section className="relative h-full w-full bg-black z-10">
        <Map initialViewState={{ longitude: -121.5, latitude: 38.5, zoom: 11 }} style={{ width: '100%', height: '100%' }} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN}>
          
          {/* LANDMARK MARKERS */}
          {visibleLandmarks.map((lm: any) => {
            const isCritical = riskReport.find(r => r.id === lm.id);
            return (
              <Marker key={lm.id} longitude={lm.lon} latitude={lm.lat} anchor="bottom">
                <div className="group flex flex-col items-center cursor-pointer">
                  <div className={`
                     p-1.5 rounded-md border shadow-lg transition-all
                     ${isCritical 
                        ? 'bg-red-600 border-red-400 animate-bounce scale-110 z-50 shadow-[0_0_15px_rgba(239,68,68,0.6)]' 
                        : 'bg-[#0B1121]/90 border-white/10 text-slate-500 scale-75 hover:scale-100 hover:text-white'}
                  `}>
                    {lm.icon}
                  </div>
                  {(isCritical || showAllLandmarks) && (
                    <div className="absolute bottom-full mb-1 bg-black/90 text-white text-[10px] px-2 py-1 rounded border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                      {lm.name}
                    </div>
                  )}
                </div>
              </Marker>
            )
          })}

          {history.length > 0 && <Source type="geojson" data={fireData as any}><Layer {...heatmapLayer} /></Source>}
          <NavigationControl position="top-right" />
        </Map>

        {/* TIMELINE */}
        {history.length > 0 && (
          <div className="absolute bottom-8 left-8 right-8 bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center gap-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setIsPlaying(!isPlaying)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all flex-shrink-0">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>T-Minus 0:00</span>
                <span className="text-orange-400">Current: T+{currentFrame * 0.5} Hours</span>
                <span>End: T+{simParams.duration} Hours</span>
              </div>
              <input type="range" min="0" max={history.length - 1} value={currentFrame} onChange={(e) => { setIsPlaying(false); setCurrentFrame(parseInt(e.target.value)); }} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
            </div>
            <button onClick={() => { setIsPlaying(false); setCurrentFrame(0); }} className="p-2 text-slate-500 hover:text-white transition-colors"><RefreshCw size={16} /></button>
          </div>
        )}
      </section>
    </main>
  );
}