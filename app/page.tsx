"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, Marker, Popup, MapRef, } from 'react-map-gl';
import { AlertTriangle, Play, Pause, Loader2, Zap, RefreshCw, Building2, LayoutDashboard, FileWarning, Globe, Terminal, PlusSquare, GraduationCap, FireExtinguisher } from 'lucide-react';

// Custom Hooks & Components
import { useSimulation } from './hooks/useSimulation'; 
import ImpactChat from './components/ImpactChat'; 
import RiskReport from './components/RiskReport'; 
import LocationPanel from './components/LocationPanel'; 
import ControlPanel from './components/ControlPanel'; 

import 'mapbox-gl/dist/mapbox-gl.css';

const RAW_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN = RAW_TOKEN.replace(/"/g, ''); 

export default function IncidentCommander() {
  const mapRef = useRef<MapRef>(null);
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'controls' | 'impact' | 'location'>('controls');
  const [showAllLandmarks, setShowAllLandmarks] = useState(false);
  
  // Map State
  const [viewport, setViewport] = useState({ latitude: 38.5, longitude: -121.5, zoom: 11 });
  const [simulationOrigin, setSimulationOrigin] = useState({ lat: 38.5, lon: -121.5 });
  const [pendingLocation, setPendingLocation] = useState<{lat: number, lon: number} | null>(null);
  const [isSelectingOnMap, setIsSelectingOnMap] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<any>(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['medical', 'power', 'response', 'school', 'civic', 'unknown']));
  const toggleFilter = (type: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(type)) newFilters.delete(type); else newFilters.add(type);
    setActiveFilters(newFilters);
  };
  
  // Data State
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [riskReport, setRiskReport] = useState<any[]>([]); 
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [isCalculatingRisks, setIsCalculatingRisks] = useState(false);

  // --- USE CUSTOM SIMULATION HOOK ---
  const { 
    simParams, setSimParams, history, setHistory, currentFrame, setCurrentFrame, 
    isPlaying, setIsPlaying, mutation, fireData, 
    triggerSimulation, notifyMapLoaded,
  } = useSimulation();

  // --- QUEUE WATCHER (Wait for Assets) ---
  useEffect(() => {
    if (!loadingMapData) {
        console.log("📡 GIS Data loading finished. Starting 2s buffer...");
        
        const bufferTimeout = setTimeout(() => {
            console.log("⏱️ Buffer complete. Notifying simulation engine.");
            notifyMapLoaded();
        }, 2000); // <--- Added your 4-second "good measure" delay

        return () => clearTimeout(bufferTimeout);
    }
  }, [loadingMapData, notifyMapLoaded]);

  // --- LOCATION HANDLER ---
  // --- HANDLE LOCATION UPDATE (Fixed for v7) ---
  // --- HANDLE LOCATION UPDATE (Fixed) ---
  const handleLocationUpdate = (lat: number, lon: number, mapReady: boolean = true) => {
    console.log("📍 Relocating to:", lat, lon);
    
    // 1. Update Simulation Data (Always do this)
    setSimulationOrigin({ lat, lon });
    setPendingLocation(null);
    setRiskReport([]); 
    setShowAllLandmarks(true); 

    // 2. Update Map View
    if (mapReady && mapRef.current) {
        // SCENARIO A: Map is fully loaded -> Fly smoothly
        mapRef.current.flyTo({
            center: [lon, lat],
            zoom: 12.5,
            pitch: 45,
            bearing: 0,
            duration: 3000, 
            essential: true 
        });
    } else {
        // SCENARIO B: Map is initializing (GPS load) -> Hard set the start point
        setViewport(prev => ({
            ...prev, // Keep existing window size
            latitude: lat,
            longitude: lon,
            zoom: 12.5,
            pitch: 45,
            bearing: 0
        }));
    }
  };

  // --- GET USER LOCATION ---
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => handleLocationUpdate(pos.coords.latitude, pos.coords.longitude, isMapLoaded),
        (err) => console.warn("GPS Error", err),
        { enableHighAccuracy: true }
      );
    }
  }, [isMapLoaded]);

  // --- GIS FETCH ---
  useEffect(() => {
    // 1. Reset View
    setShowAllLandmarks(false); 
    setRiskReport([]); 

    const fetchInfrastructure = async () => {
      console.log("📡 Fetching Assets for:", simulationOrigin);
      setLoadingMapData(true); 

      // 2. CALCULATE DYNAMIC RADIUS
      // We still read the duration here, but it won't TRIGGER the effect anymore.
      const expansionFactor = (simParams.duration || 24) * 0.02;
      const radius = Math.min(0.04 + expansionFactor, 0.50); 
      
      console.log(`🌍 Search Radius set to: ${(radius * 111).toFixed(1)} km`);

      const latMin = simulationOrigin.lat - radius;
      const latMax = simulationOrigin.lat + radius;
      const lonMin = simulationOrigin.lon - radius;
      const lonMax = simulationOrigin.lon + radius;
      
      const query = `[out:json][timeout:90];(nwr["amenity"="hospital"](${latMin},${lonMin},${latMax},${lonMax});nwr["healthcare"="hospital"](${latMin},${lonMin},${latMax},${lonMax});nwr["amenity"="clinic"](${latMin},${lonMin},${latMax},${lonMax});nwr["power"="substation"](${latMin},${lonMin},${latMax},${lonMax});nwr["power"="generator"](${latMin},${lonMin},${latMax},${lonMax});nwr["amenity"="fire_station"](${latMin},${lonMin},${latMax},${lonMax});nwr["amenity"="school"](${latMin},${lonMin},${latMax},${lonMax});nwr["emergency"="designated"](${latMin},${lonMin},${latMax},${lonMax}););out center;`; 

      try {
        const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query });
        const data = await response.json();
        
        const processed = data.elements.map((node: any) => {
           let type = "unknown";
           let baseValue = 1000000;
           if (node.tags.amenity === "hospital" || node.tags.healthcare === "hospital" || node.tags.amenity === "clinic") { type = "medical"; baseValue = 15000000; }
           else if (node.tags.power === "substation" || node.tags.power === "generator") { type = "power"; baseValue = 5000000; }
           else if (node.tags.amenity === "fire_station") { type = "response"; baseValue = 3000000; }
           else if (node.tags.amenity === "school") { type = "school"; baseValue = 12000000; }
           
           const lat = node.lat || node.center?.lat;
           const lon = node.lon || node.center?.lon;
           if (!lat || !lon) return null;
           
           return { 
               id: node.id, 
               name: node.tags.name || `${type} Asset`, 
               type, 
               lat, 
               lon,
               estimatedValue: baseValue
           };
        }).filter((i: any) => i !== null);
        
        console.log(`✅ GIS Loaded: ${processed.length} assets.`);
        setLandmarks(processed);
      } catch (error) { console.error("GIS Error:", error); } 
      finally { setLoadingMapData(false); }
    };

    fetchInfrastructure();
  }, [simulationOrigin]); // <--- FIXED: Removed 'simParams.duration'

  // --- RISK CALCULATION (FIXED) ---
  useEffect(() => {
      // 1. Safety Check: Do we have data to crunch?
      if (history.length === 0 || landmarks.length === 0) return;

      // 2. Optimization: If we already have a report for this exact history, skip (prevents loops)
      // We check if the first risk matches the current history timestamp or id if available
      // For now, we just let it recalculate to be safe.

      console.log(`⚠️ Calculating Risks: Checking ${landmarks.length} assets against fire...`);
      setIsCalculatingRisks(true);
      
      // 3. Small timeout to allow the 'landmarks' state to fully settle in React's memory
      const calcTimer = setTimeout(() => {
          const impactMap: Record<number, any> = {};
          const range = 0.015; // Hit radius

          history.forEach((frame) => {
            frame.forEach((firePoint: any) => {
              if (firePoint.intensity < 0.2) return;
              
              landmarks.forEach(lm => {
                if (impactMap[lm.id]) return; // Already registered as hit
                
                // Fast Box Check (Optimization)
                if (Math.abs(firePoint.lat - lm.lat) > range) return;
                if (Math.abs(firePoint.lon - lm.lon) > range) return;
                
                // Precise Distance Check
                const dist = Math.sqrt(Math.pow(firePoint.lat - lm.lat, 2) + Math.pow(firePoint.lon - lm.lon, 2));
                if (dist < 0.008) { 
                    impactMap[lm.id] = { ...lm, timeToImpact: (firePoint.step || 0) * 0.5 }; // Assuming step info is available or approximate with frame index
                    // Fallback if step isn't in point data: use frame index from the outer loop if needed
                }
              });
            });
          });
          
          const report = Object.values(impactMap).sort((a: any, b: any) => parseFloat(a.timeToImpact) - parseFloat(b.timeToImpact));
          
          console.log(`🔥 Risk Report Generated: ${report.length} impacts.`);
          setRiskReport(report);
          setIsCalculatingRisks(false);
          
          // Only switch tabs if we actually found something
          if (report.length > 0) { 
              setActiveTab('impact'); 
              setShowAllLandmarks(false); 
          }
      }, 100); // 100ms "State Settle" Buffer

      return () => clearTimeout(calcTimer);

  }, [history, landmarks]); // <--- THIS DEPENDENCY ARRAY IS KEY

  // --- MEMOS ---
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
      return item.name.toLowerCase().includes(searchTerm.toLowerCase()) && activeFilters.has(item.type);
    };
    return { filteredMarkers: mapSource.filter(filterFn), filteredRisks: riskReport.filter(filterFn) };
  }, [landmarks, riskReport, showAllLandmarks, searchTerm, activeFilters]);

  // --- RENDER ---
  return (
    <main className="bg-[#0a0e1a] text-slate-200 font-sans selection:bg-orange-500/30" style={{ display: 'grid', gridTemplateColumns: '480px 1fr', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* SIDEBAR */}
      <aside className="relative flex flex-col h-full bg-[#0B1121] border-r border-white/5 shadow-2xl z-20 overflow-hidden">
        {/* HEADER */}
        <div className="p-6 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-sm relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-lg border border-orange-500/30"><AlertTriangle className="text-orange-500" size={22} /></div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">INCIDENT<br/><span className="text-orange-500">COMMANDER</span></h1>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg">
            <button onClick={() => setActiveTab('controls')} className={`py-2 text-[10px] font-bold rounded-md transition-all ${activeTab === 'controls' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><LayoutDashboard size={14} className="inline mr-1"/> CONTROLS</button>
            <button onClick={() => setActiveTab('impact')} className={`py-2 text-[10px] font-bold rounded-md transition-all ${activeTab === 'impact' ? 'bg-red-900/50 text-red-200' : 'text-slate-500'}`}><FileWarning size={14} className="inline mr-1"/> IMPACT</button>
            <button onClick={() => setActiveTab('location')} className={`py-2 text-[10px] font-bold rounded-md transition-all ${activeTab === 'location' ? 'bg-blue-900/50 text-blue-200' : 'text-slate-500'}`}><Globe size={14} className="inline mr-1"/> LOCATE</button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
          {activeTab === 'controls' && (
             <div className="space-y-6">
                <ControlPanel 
                  simParams={simParams} setSimParams={setSimParams} 
                  aiPrompt={""} setAiPrompt={()=>{}} onExecuteAI={()=>{}} isAiLoading={false} 
                />
                <button 
                  onClick={() => triggerSimulation(simulationOrigin, loadingMapData)} 
                  disabled={mutation.isPending} 
                  className="w-full bg-orange-600 p-4 rounded-lg font-bold flex items-center justify-center gap-3 hover:bg-orange-500 transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)]"
                >
                   {mutation.isPending ? <Loader2 className="animate-spin" /> : <Zap size={18} />} RUN PREDICTIVE MODEL
                </button>
             </div>
          )}
          {activeTab === 'impact' && (
            <RiskReport risks={filteredRisks} totalCount={riskReport.length} showAll={showAllLandmarks} onToggleView={() => setShowAllLandmarks(!showAllLandmarks)} searchTerm={searchTerm} onSearchChange={setSearchTerm} activeFilters={activeFilters} onToggleFilter={toggleFilter}/>
          )}
          {activeTab === 'location' && (
            <LocationPanel currentLat={viewport.latitude} currentLon={viewport.longitude} onLocationUpdate={handleLocationUpdate} isSelectingOnMap={isSelectingOnMap} setIsSelectingOnMap={setIsSelectingOnMap}/>
          )}
        </div>

        {/* CHAT HUB */}
        <div className="h-[40%] flex flex-col border-t border-white/10 bg-[#05050a] relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
           <div className="px-4 py-2 bg-[#0B1121] border-b border-white/5 text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={12}/> AI Command Interface
           </div>
           <div className="flex-1 overflow-hidden">
               <ImpactChat 
                  riskReport={riskReport}
                  onUpdateParams={(p) => setSimParams(prev => ({...prev, ...p}))}
                  onUpdateLocation={handleLocationUpdate}
                  
                  // FIX: Pass overrides and forceQueue flag to the hook
                  onTriggerSim={(overrides, forceQueue) => triggerSimulation(simulationOrigin, loadingMapData, overrides, forceQueue)}
                  
                  isMapLoading={loadingMapData}
              />
           </div>
        </div>
      </aside>

      {/* MAP */}
      <section className="relative h-full w-full bg-black z-10">
        <Map 
            ref={mapRef} {...viewport} onLoad={() => setIsMapLoaded(true)} 
            onMove={evt => setViewport(evt.viewState)} 
            onClick={(evt) => { if(activeTab==='location'||isSelectingOnMap) setPendingLocation({lat:evt.lngLat.lat, lon:evt.lngLat.lng}); }}
            style={{ width: '100%', height: '100%' }} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN} cursor={isSelectingOnMap ? 'crosshair' : 'auto'}
        >
             {/* PENDING LOCATION POPUP (For "Move Here" clicks) */}
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

              {/* ASSET MARKERS (With Hover Logic) */}
              {filteredMarkers.map((lm: any) => { 
                const isCritical = riskReport.find(r => r.id === lm.id);
                return (
                  <Marker key={lm.id} longitude={lm.lon} latitude={lm.lat} anchor="bottom">
                    <div 
                        className="group flex flex-col items-center cursor-pointer"
                        onMouseEnter={() => setHoverInfo(lm)}  // <--- ADDED
                        onMouseLeave={() => setHoverInfo(null)} // <--- ADDED
                    >
                      <div className={`p-1.5 rounded-md border shadow-lg transition-all ${isCritical ? 'bg-red-600 border-red-400 scale-110 z-50 shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-[#0B1121]/90 border-white/10 text-slate-500 scale-75 hover:scale-100 hover:text-white'}`}>
                          {getLandmarkIcon(lm.type, 14)}
                      </div>
                    </div>
                  </Marker>
                )
              })}

              {/* HOVER TOOLTIP POPUP (New) */}
              {hoverInfo && (
                <Popup
                    longitude={hoverInfo.lon}
                    latitude={hoverInfo.lat}
                    offset={25}
                    closeButton={false}
                    closeOnClick={false}
                    anchor="bottom"
                    className="z-50"
                >
                    <div className="px-2 py-1 bg-white text-slate-900 text-[10px] font-bold rounded shadow-xl uppercase tracking-wider border border-slate-200">
                    {hoverInfo.name}
                    </div>
                </Popup>
              )}

              {/* HEATMAP LAYER */}
              {history.length > 0 && <Source type="geojson" data={fireData as any}><Layer id='fire-heat' type='heatmap' paint={{ 'heatmap-weight': ['get', 'intensity'], 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.1, 'rgba(50,0,0,0.5)', 0.3, 'rgb(100,0,0)', 0.6, 'rgb(255,100,0)', 1, 'rgb(255,255,200)'], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 15, 11, 25, 15, 50], 'heatmap-opacity': 0.80 }} /></Source>}
              
              <NavigationControl position="bottom-right" />
        </Map>
        
        {/* LOADING OVERLAY */}
        {loadingMapData && (
             <div className="absolute top-4 left-4 z-50 animate-in fade-in slide-in-from-top-4">
                <div className="bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl flex items-center gap-3">
                  <div className="p-2 rounded-md bg-amber-500/20 text-amber-400"><Loader2 size={16} className="animate-spin"/></div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GIS Uplink</span><span className="text-xs font-mono font-bold text-amber-400">INGESTING ASSETS...</span></div>
                </div>
             </div>
        )}

        {/* TIMELINE CONTROLS */}
        {history.length > 0 && (
          <div className="absolute bottom-8 left-8 right-16 bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-xl p-4 flex items-center gap-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
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