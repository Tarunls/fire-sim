"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, Marker, Popup, MapRef } from 'react-map-gl';
import { 
  AlertTriangle, Play, Pause, Loader2, Zap, RefreshCw, 
  Building2, LayoutDashboard, FileWarning, FireExtinguisher, MessageSquare,
  PlusSquare, GraduationCap, Globe, Cpu, Compass, Thermometer, Droplets, Mountain, Waves, Clock, Terminal
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

import ImpactChat from './components/ImpactChat';
import RiskReport from './components/RiskReport'; 
import LocationPanel from './components/LocationPanel'; 
import ControlPanel from './components/ControlPanel'; 

import 'mapbox-gl/dist/mapbox-gl.css';

const RAW_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN = RAW_TOKEN.replace(/"/g, ''); 

export default function IncidentCommander() {
  const mapRef = useRef<MapRef>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<'controls' | 'impact' | 'location' | 'chat'>('controls');
  // FIX 1: Default to TRUE so user sees data initially, or handle in location update
  const [showAllLandmarks, setShowAllLandmarks] = useState(false); 
  
  // --- LOCATION STATE ---
  const [viewport, setViewport] = useState({ latitude: 38.5, longitude: -121.5, zoom: 11 });
  const [simulationOrigin, setSimulationOrigin] = useState({ lat: 38.5, lon: -121.5 });
  const [pendingLocation, setPendingLocation] = useState<{lat: number, lon: number} | null>(null);
  const [isSelectingOnMap, setIsSelectingOnMap] = useState(false);

  // --- GET USER LOCATION ---
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log("📍 GPS Success:", latitude, longitude);
          handleLocationUpdate(latitude, longitude);
        },
        (error) => console.warn("Geolocation denied. Defaulting to Sacramento.")
      );
    }
  }, []);

  const handleLocationUpdate = (lat: number, lon: number) => {
    // A. Update Logic Center
    setSimulationOrigin({ lat, lon });
    
    // B. Move Camera (Standard State Update)
    setViewport(prev => ({ ...prev, latitude: lat, longitude: lon, zoom: 12 }));

    // C. Reset Data
    setLandmarks([]); 
    setHistory([]); 
    setRiskReport([]); 
    setPendingLocation(null); 
    setIsSelectingOnMap(false); 
    setActiveTab('controls');

    // FIX 2: FORCE ICONS TO SHOW
    // When we move to a new location, show the assets immediately so the map isn't empty
    setShowAllLandmarks(true); 

    // D. Fly Animation (Optional polish, but state update above handles the move)
    if (mapRef.current) {
        mapRef.current.flyTo({ center: [lon, lat], zoom: 12, duration: 2000 });
    }
  };

  // --- FILTER & SIM PARAMS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['medical', 'power', 'response', 'school', 'civic', 'unknown']));
  const toggleFilter = (type: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(type)) newFilters.delete(type); else newFilters.add(type);
    setActiveFilters(newFilters);
  };

  const [simParams, setSimParams] = useState({
    windSpeed: 50, windDir: 'NW', moisture: 10, humidity: 20, temperature: 95, slope: 15, duration: 24 
  });

  // --- DATA STATE ---
  const [aiPrompt, setAiPrompt] = useState('');
  const [history, setHistory] = useState<any[]>([]); 
  const [currentFrame, setCurrentFrame] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCalculatingRisks, setIsCalculatingRisks] = useState(false);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [riskReport, setRiskReport] = useState<any[]>([]); 
  const [loadingMapData, setLoadingMapData] = useState(false);

  // --- GIS FETCH ---
  useEffect(() => {
    const fetchInfrastructure = async () => {
      setLoadingMapData(true);
      const centerLat = simulationOrigin.lat;
      const centerLon = simulationOrigin.lon;
      const scale = 0.004; 
      const gridSize = 200; 
      const halfSize = gridSize / 2;
      const latMin = centerLat - (halfSize * scale);
      const latMax = centerLat + (halfSize * scale);
      const lonMin = centerLon - (halfSize * scale);
      const lonMax = centerLon + (halfSize * scale);

      const query = `[out:json][timeout:90];(nwr["amenity"="hospital"](${latMin},${lonMin},${latMax},${lonMax});nwr["healthcare"="hospital"](${latMin},${lonMin},${latMax},${lonMax});nwr["amenity"="clinic"](${latMin},${lonMin},${latMax},${lonMax});nwr["power"="substation"](${latMin},${lonMin},${latMax},${lonMax});nwr["power"="generator"](${latMin},${lonMin},${latMax},${lonMax});nwr["amenity"="fire_station"](${latMin},${lonMin},${latMax},${lonMax});nwr["amenity"="school"](${latMin},${lonMin},${latMax},${lonMax});nwr["emergency"="designated"](${latMin},${lonMin},${latMax},${lonMax}););out center;`; 

      try {
        const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query });
        const data = await response.json();
        const processed = data.elements.map((node: any) => {
          let type = "unknown"; let priority = 0;
          if ((node.tags.amenity === "hospital" || node.tags.healthcare === "hospital") || (node.tags.amenity === "clinic")) { type = "medical"; priority = 10; }
          else if (node.tags.power === "substation" || node.tags.power === "generator") { type = "power"; priority = 8; }
          else if (node.tags.amenity === "fire_station") { type = "response"; priority = 9; }
          else if (node.tags.amenity === "school") { type = "school"; priority = 5; }
          const lat = node.lat || node.center?.lat;
          const lon = node.lon || node.center?.lon;
          if (!lat || !lon) return null;
          return { id: node.id, name: node.tags.name || `${type} Asset`, type, lat, lon, priority };
        }).filter((i: any) => i !== null);
        setLandmarks(processed);
      } catch (error) { console.error("GIS Error:", error); } 
      finally { setLoadingMapData(false); }
    };
    fetchInfrastructure();
  }, [simulationOrigin]);

  const getLandmarkIcon = (type: string, size: number = 18) => {
    switch (type) {
      case 'medical': return <PlusSquare size={size} />;
      case 'power': return <Zap size={size} />;
      case 'response': return <FireExtinguisher size={size} />;
      case 'school': return <GraduationCap size={size} />;
      default: return <Building2 size={size} />;
    }
  };

  const { filteredMarkers, filteredRisks } = useMemo(() => {
    const mapSource = showAllLandmarks ? landmarks : riskReport;
    const filterFn = (item: any) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = activeFilters.has(item.type);
      return matchesSearch && matchesType;
    };
    return { filteredMarkers: mapSource.filter(filterFn), filteredRisks: riskReport.filter(filterFn) };
  }, [landmarks, riskReport, showAllLandmarks, searchTerm, activeFilters]);

  const calculateRisk = (simHistory: any[]) => {
    setTimeout(() => {
      const impactMap: Record<number, any> = {};
      const range = 0.015; 
      simHistory.forEach((frame, idx) => {
        frame.forEach((firePoint: any) => {
          if (firePoint.intensity < 0.2) return;
          landmarks.forEach(lm => {
            if (impactMap[lm.id]) return; 
            if (Math.abs(firePoint.lat - lm.lat) > range) return;
            if (Math.abs(firePoint.lon - lm.lon) > range) return;
            const dist = Math.sqrt(Math.pow(firePoint.lat - lm.lat, 2) + Math.pow(firePoint.lon - lm.lon, 2));
            if (dist < 0.008) { impactMap[lm.id] = { ...lm, timeToImpact: (idx * 0.5).toFixed(1), icon: getLandmarkIcon(lm.type, 16) }; }
          });
        });
      });
      const report = Object.values(impactMap).sort((a: any, b: any) => parseFloat(a.timeToImpact) - parseFloat(b.timeToImpact));
      setRiskReport(report);
      setIsCalculatingRisks(false); 
      // If risks found, switch to Impact tab and show risks. 
      // If no risks, we stay on 'showAll' or whatever the user had.
      if (report.length > 0) { 
          setActiveTab('impact'); 
          setShowAllLandmarks(false); // Focus on risks
      }
    }, 400); 
  };

  const mutation = useMutation({
    mutationFn: async (params: typeof simParams) => {
      const payload = { ...params, originLat: simulationOrigin.lat, originLon: simulationOrigin.lon };
      const res = await fetch('http://127.0.0.1:8000/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return res.json();
    },
    onSuccess: (data) => { setHistory(data.data); setCurrentFrame(0); setIsPlaying(true); setIsCalculatingRisks(true); calculateRisk(data.data); }
  });

  const aiMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('http://127.0.0.1:8000/parse-command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text }) });
      return res.json();
    },
    onSuccess: (data) => { 
      setSimParams(prev => ({ ...prev, ...data.params })); 
      if (data.params.originLat && data.params.originLon) {
         handleLocationUpdate(data.params.originLat, data.params.originLon);
         mutation.mutate({ ...simParams, ...data.params, originLat: data.params.originLat, originLon: data.params.originLon });
      } else {
         mutation.mutate({ ...simParams, ...data.params });
      }
      setAiPrompt(''); 
    }
  });
  const handleAICommand = () => { if (aiPrompt.trim()) aiMutation.mutate(aiPrompt); };

  useEffect(() => {
    if (isPlaying && history.length > 0) {
      animationRef.current = setTimeout(() => {
        setCurrentFrame((prev) => { if (prev >= history.length - 1) { setIsPlaying(false); return prev; } return prev + 1; });
      }, 100); 
    }
    return () => clearTimeout(animationRef.current as NodeJS.Timeout);
  }, [isPlaying, currentFrame, history]);

  const fireData = useMemo(() => {
    let activePoints = (history.length > 0 && history[currentFrame]) ? history[currentFrame] : [];
    if (!Array.isArray(activePoints)) activePoints = [];
    return { type: 'FeatureCollection', features: activePoints.map((point: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [point.lon, point.lat] }, properties: { intensity: point.intensity } })) };
  }, [history, currentFrame]);

  const heatmapLayer: any = { id: 'fire-heat', type: 'heatmap', paint: { 'heatmap-weight': ['get', 'intensity'], 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.1, 'rgba(50,0,0,0.5)', 0.3, 'rgb(100,0,0)', 0.6, 'rgb(255,100,0)', 1, 'rgb(255,255,200)'], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 15, 11, 25, 15, 50], 'heatmap-opacity': 0.80 } };
  
  const onMapClick = (evt: any) => { 
    if (activeTab === 'location' || isSelectingOnMap) { 
      const { lng, lat } = evt.lngLat; 
      setPendingLocation({ lat, lon: lng }); 
    } 
  };

  return (
    <main className="bg-[#0a0e1a] text-slate-200 font-sans selection:bg-orange-500/30" style={{ display: 'grid', gridTemplateColumns: '480px 1fr', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <aside className="relative flex flex-col h-full bg-[#0B1121] border-r border-white/5 shadow-2xl z-20 overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-lg border border-orange-500/30"><AlertTriangle className="text-orange-500" size={22} /></div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">INCIDENT<br/><span className="text-orange-500">COMMANDER</span></h1>
          </div>
          
          <div className="grid grid-cols-4 gap-1 bg-black/40 p-1 rounded-lg">
            <button onClick={() => setActiveTab('controls')} className={`py-2 text-[10px] font-bold rounded-md transition-all flex flex-col md:flex-row items-center justify-center gap-1 ${activeTab === 'controls' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutDashboard size={14}/> <span>CONTROLS</span></button>
            <button onClick={() => setActiveTab('impact')} className={`py-2 text-[10px] font-bold rounded-md transition-all flex flex-col md:flex-row items-center justify-center gap-1 ${activeTab === 'impact' ? 'bg-red-900/50 text-red-200 shadow-sm border border-red-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                <FileWarning size={14}/> <span>IMPACT</span>
                {riskReport.length > 0 && <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-[9px] px-1 rounded-full">{riskReport.length}</span>}
            </button>
            <button onClick={() => setActiveTab('location')} className={`py-2 text-[10px] font-bold rounded-md transition-all flex flex-col md:flex-row items-center justify-center gap-1 ${activeTab === 'location' ? 'bg-blue-900/50 text-blue-200 shadow-sm border border-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}><Globe size={14}/> <span>LOCATE</span></button>
            <button onClick={() => setActiveTab('chat')} className={`py-2 text-[10px] font-bold rounded-md transition-all flex flex-col md:flex-row items-center justify-center gap-1 ${activeTab === 'chat' ? 'bg-emerald-900/50 text-emerald-200 shadow-sm border border-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}><MessageSquare size={14}/> <span>INTEL</span></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
          {activeTab === 'controls' && (
            <ControlPanel 
              simParams={simParams} setSimParams={setSimParams} 
              aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} 
              onExecuteAI={handleAICommand} isAiLoading={aiMutation.isPending} 
            />
          )}

          {activeTab === 'chat' && (
            <ImpactChat riskReport={riskReport} />
          )}

          {activeTab === 'impact' && (
            <RiskReport 
              risks={filteredRisks} totalCount={riskReport.length} showAll={showAllLandmarks} 
              onToggleView={() => setShowAllLandmarks(!showAllLandmarks)} 
              searchTerm={searchTerm} onSearchChange={setSearchTerm} 
              activeFilters={activeFilters} onToggleFilter={toggleFilter}
            />
          )}

          {activeTab === 'location' && (
            <LocationPanel 
              currentLat={viewport.latitude} currentLon={viewport.longitude} 
              onLocationUpdate={handleLocationUpdate}
              isSelectingOnMap={isSelectingOnMap} setIsSelectingOnMap={setIsSelectingOnMap}
            />
          )}
        </div>

        <div className="p-6 mt-auto border-t border-white/10 bg-[#0f172a] relative z-20">
          <button onClick={() => mutation.mutate(simParams)} disabled={mutation.isPending} className="w-full bg-orange-600 p-4 rounded-lg font-bold flex items-center justify-center gap-3 hover:bg-orange-500 transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)]">
            {mutation.isPending ? <Loader2 className="animate-spin" /> : <Zap size={18} />} RUN PREDICTIVE MODEL
          </button>
        </div>
      </aside>

      <section className="relative h-full w-full bg-black z-10">
        <Map 
          ref={mapRef} 
          // FIX 3: CONTROLLED MAP MODE
          {...viewport} // Pass all viewport props (latitude, longitude, zoom) directly
          onMove={evt => setViewport(evt.viewState)} 
          onClick={onMapClick} 
          style={{ width: '100%', height: '100%' }} 
          mapStyle="mapbox://styles/mapbox/dark-v11" 
          mapboxAccessToken={MAPBOX_TOKEN} 
          cursor={isSelectingOnMap ? 'crosshair' : 'auto'}
        >
          {pendingLocation && (
            <Popup latitude={pendingLocation.lat} longitude={pendingLocation.lon} closeButton={false} closeOnClick={false} anchor="bottom" offset={10}>
              <div className="p-2 bg-[#0a0e1a] rounded text-white min-w-[150px]">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Confirm Start Point?</div>
                <div className="text-xs font-mono text-emerald-400 mb-3">{pendingLocation.lat.toFixed(4)}, {pendingLocation.lon.toFixed(4)}</div>
                <div className="flex gap-2">
                  <button onClick={() => handleLocationUpdate(pendingLocation.lat, pendingLocation.lon)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1 rounded">CONFIRM</button>
                  <button onClick={() => setPendingLocation(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold py-1 rounded">CANCEL</button>
                </div>
              </div>
            </Popup>
          )}
          {isCalculatingRisks && (
            <div className="absolute top-4 left-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-blue-500/30 rounded-lg p-4 shadow-2xl flex items-center gap-4 min-w-[280px]">
                <div className="p-2.5 bg-blue-500/20 rounded-md border border-blue-500/30 animate-pulse"><Cpu size={20} className="text-blue-400" /></div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-blue-200"><span>Calculating Intersections</span><span className="animate-pulse">...</span></div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 w-full animate-[shimmer_1.5s_infinite_linear] origin-left"></div></div>
                  <div className="text-[9px] text-slate-400 font-mono">Analyzing {landmarks.length} vector nodes...</div>
                </div>
              </div>
            </div>
          )}
          {loadingMapData && (
             <div className="absolute top-4 left-4 z-50 animate-in fade-in slide-in-from-top-4">
                <div className="bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl flex items-center gap-3">
                  <div className="p-2 rounded-md bg-amber-500/20 text-amber-400"><Loader2 size={16} className="animate-spin"/></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GIS Uplink</span><span className="text-xs font-mono font-bold text-amber-400">INGESTING DATA...</span></div>
                </div>
             </div>
          )}
          {filteredMarkers.map((lm: any) => { 
            const isCritical = riskReport.find(r => r.id === lm.id);
            return (
              <Marker key={lm.id} longitude={lm.lon} latitude={lm.lat} anchor="bottom">
                <div className="group flex flex-col items-center cursor-pointer">
                  <div className={`p-1.5 rounded-md border shadow-lg transition-all ${isCritical ? 'bg-red-600 border-red-400 scale-110 z-50 shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-[#0B1121]/90 border-white/10 text-slate-500 scale-75 hover:scale-100 hover:text-white'}`}>{getLandmarkIcon(lm.type, 14)}</div>
                  {(isCritical || showAllLandmarks) && <div className="absolute bottom-full mb-1 bg-black/90 text-white text-[10px] px-2 py-1 rounded border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">{lm.name}</div>}
                </div>
              </Marker>
            )
          })}
          {history.length > 0 && <Source type="geojson" data={fireData as any}><Layer {...heatmapLayer} /></Source>}
          <NavigationControl position="top-right" />
        </Map>
        {history.length > 0 && (
          <div className="absolute bottom-8 left-8 right-8 bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center gap-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setIsPlaying(!isPlaying)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all flex-shrink-0">{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest"><span>T-Minus 0:00</span><span className="text-orange-400 font-mono">EST: T+{ (currentFrame * 0.5).toFixed(1) } HRS</span><span>T-{simParams.duration}:00</span></div>
              <input type="range" min="0" max={history.length - 1} value={currentFrame} onChange={(e) => { setIsPlaying(false); setCurrentFrame(parseInt(e.target.value)); }} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
            </div>
            <button onClick={() => { setIsPlaying(false); setCurrentFrame(0); }} className="p-2 text-slate-500 hover:text-white transition-colors"><RefreshCw size={16} /></button>
          </div>
        )}
      </section>
    </main>
  );
}