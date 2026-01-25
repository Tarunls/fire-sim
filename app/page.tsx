"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Map, { NavigationControl, Source, Layer, Marker, Popup, MapRef, } from 'react-map-gl';
import { 
  AlertTriangle, Play, Pause, Loader2, Zap, RefreshCw, Building2, 
  LayoutDashboard, FileWarning, Globe, Terminal, PlusSquare, 
  GraduationCap, FireExtinguisher, Menu, X
} from 'lucide-react';

// Custom Hooks & Components
import { useSimulation } from './hooks/useSimulation'; 
import ImpactChat from './components/ImpactChat'; 
import RiskReport from './components/RiskReport'; 
import LocationPanel from './components/LocationPanel'; 
import ControlPanel from './components/ControlPanel'; 
import { setMuteSpeech } from './utils/elevenLabs';

import 'mapbox-gl/dist/mapbox-gl.css';

const RAW_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const MAPBOX_TOKEN = RAW_TOKEN.replace(/"/g, ''); 

const normalizeWindDir = (dir: string): string => {
  const map: Record<string, string> = {
    'NNE': 'N',
    'ENE': 'E',
    'ESE': 'E',
    'SSE': 'S',
    'SSW': 'S',
    'WSW': 'W',
    'WNW': 'W',
    'NNW': 'N',
    // These might already be in your 8-point list, 
    // but we include them for safety:
    'N': 'N', 'NE': 'NE', 'E': 'E', 'SE': 'SE', 
    'S': 'S', 'SW': 'SW', 'W': 'W', 'NW': 'NW'
  };

  return map[dir.toUpperCase()] || dir; 
};

export default function IncidentCommander() {
  const mapRef = useRef<MapRef>(null);
  const [routeStops, setRouteStops] = useState<any[]>([]);
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'controls' | 'impact' | 'location'>('controls');
  const [showAllLandmarks, setShowAllLandmarks] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // MOBILE STATE
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // <--- New State for Mobile Drawer

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
  
  const handleToggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    setMuteSpeech(newMuteState); // Update the utility
  };

  // Data State
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [riskReport, setRiskReport] = useState<any[]>([]); 
  const [loadingMapData, setLoadingMapData] = useState(false);
  const [isCalculatingRisks, setIsCalculatingRisks] = useState(false);

  // --- HOOKS ---
  const { 
    simParams, setSimParams, history, setHistory, currentFrame, setCurrentFrame, 
    isPlaying, setIsPlaying, mutation, fireData, 
    triggerSimulation, notifyMapLoaded,
  } = useSimulation();

  // --- QUEUE WATCHER ---
  useEffect(() => {
    if (!loadingMapData) {
        const bufferTimeout = setTimeout(() => {
            notifyMapLoaded();
        }, 2000); 
        return () => clearTimeout(bufferTimeout);
    }
  }, [loadingMapData, notifyMapLoaded]);

  const syncRealWeather = async () => {
  try {
    // 1. Get the metadata for your current simulation origin
    const pointRes = await fetch(`https://api.weather.gov/points/${simulationOrigin.lat},${simulationOrigin.lon}`);
    const pointData = await pointRes.json();
    
    // 2. Fetch the hourly forecast link provided by NOAA
    const forecastUrl = pointData.properties.forecastHourly;
    const weatherRes = await fetch(forecastUrl);
    const weatherData = await weatherRes.json();
    
    // 3. Extract the latest hour
    const current = weatherData.properties.periods[0];
    const rawDir = current.windDirection; // e.g., "NNW"
    const cleanDir = normalizeWindDir(rawDir); // Result: "N"

    setSimParams({
      ...simParams,
      temperature: current.temperature,
      windSpeed: parseInt(current.windSpeed),
      windDir: cleanDir, // <--- Snapped to your grid!
    });
        
    console.log("☁️ Weather Synced:", current.shortForecast);
  } catch (err) {
    console.error("Weather Sync Failed:", err);
  }
};

  // --- LOCATION HANDLER ---
  const handleLocationUpdate = (lat: number, lon: number, mapReady: boolean = true) => {
    setSimulationOrigin({ lat, lon });
    setPendingLocation(null);
    setRiskReport([]); 
    setShowAllLandmarks(true); 
    
    // Auto-close mobile sidebar when moving location
    setIsSidebarOpen(false);

    if (mapReady && mapRef.current) {
        mapRef.current.flyTo({
            center: [lon, lat], zoom: 12.5, pitch: 45, bearing: 0, duration: 3000, essential: true 
        });
    } else {
        setViewport(prev => ({ ...prev, latitude: lat, longitude: lon, zoom: 12.5, pitch: 45, bearing: 0 }));
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
    setShowAllLandmarks(false); 
    setRiskReport([]); 

    const fetchInfrastructure = async () => {
      setLoadingMapData(true); 
      const expansionFactor = (simParams.duration || 24) * 0.02;
      const radius = Math.min(0.04 + expansionFactor, 0.50); 
      
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
           
           return { id: node.id, name: node.tags.name || `${type} Asset`, type, lat, lon, estimatedValue: baseValue };
        }).filter((i: any) => i !== null);
        setLandmarks(processed);
      } catch (error) { console.error("GIS Error:", error); } 
      finally { setLoadingMapData(false); }
    };
    fetchInfrastructure();
  }, [simulationOrigin]); 

  // --- RISK CALCULATION ---
  useEffect(() => {
      if (history.length === 0 || landmarks.length === 0) return;
      setIsCalculatingRisks(true);
      
      const calcTimer = setTimeout(() => {
          const impactMap: Record<number, any> = {};
          const range = 0.015; 


      history.forEach((frame, frameIndex) => { // <--- Added frameIndex here
            frame.forEach((firePoint: any) => {
              if (firePoint.intensity < 0.2) return;
              
              landmarks.forEach(lm => {
                if (impactMap[lm.id]) return; 
                
                const dist = Math.sqrt(Math.pow(firePoint.lat - lm.lat, 2) + Math.pow(firePoint.lon - lm.lon, 2));
                
                if (dist < 0.008) { 
                    // FIX: If firePoint.step is missing, use the frameIndex from the loop
                    const actualStep = firePoint.step !== undefined ? firePoint.step : frameIndex;
                    
                    impactMap[lm.id] = { 
                        ...lm, 
                        // 0.5 represents 30-minute intervals per frame
                        timeToImpact: (actualStep * 0.5).toFixed(1) 
                    };
                }
              });
            });
          });
          
          const report = Object.values(impactMap).sort((a: any, b: any) => parseFloat(a.timeToImpact) - parseFloat(b.timeToImpact));
          setRiskReport(report);
          setIsCalculatingRisks(false);
          
          if (report.length > 0) { 
              setActiveTab('impact'); 
              setShowAllLandmarks(false);
              setIsSidebarOpen(true); // Auto-open sidebar on mobile if risks found
          }
      }, 100); 

      return () => clearTimeout(calcTimer);
  }, [history, landmarks]);

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
    // UPDATED LAYOUT: removed inline grid, used flex column for mobile, grid for desktop
    <main className="relative h-screen w-screen bg-[#0a0e1a] text-slate-200 font-sans overflow-hidden flex flex-col md:grid md:grid-cols-[480px_1fr]">
      
      {/* --- SIDEBAR (RESPONSIVE DRAWER) --- */}
      <aside className={`
          fixed inset-0 z-50 bg-[#0B1121] flex flex-col h-screen max-h-screen border-r border-white/5 shadow-2xl transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* HEADER */}
        <div className="p-6 border-b flex-shrink-0 border-white/10 bg-[#0f172a]/80 backdrop-blur-sm relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-lg border border-orange-500/30"><AlertTriangle className="text-orange-500" size={22} /></div>
                <h1 className="text-lg font-black tracking-tight text-white leading-none">INCIDENT<br/><span className="text-orange-500">COMMANDER</span></h1>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-lg w-full">
                <button onClick={() => setActiveTab('controls')} className={`py-2 px-2 text-[10px] font-bold rounded-md transition-all ${activeTab === 'controls' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}><LayoutDashboard size={14} className="inline mr-1"/> CONTROL</button>
                <button onClick={() => setActiveTab('impact')} className={`py-2 px-2 text-[10px] font-bold rounded-md transition-all ${activeTab === 'impact' ? 'bg-red-900/50 text-red-200' : 'text-slate-500'}`}><FileWarning size={14} className="inline mr-1"/> IMPACT</button>
                <button onClick={() => setActiveTab('location')} className={`py-2 px-2 text-[10px] font-bold rounded-md transition-all ${activeTab === 'location' ? 'bg-blue-900/50 text-blue-200' : 'text-slate-500'}`}><Globe size={14} className="inline mr-1"/> LOCATE</button>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar pb-20 md:pb-6">
          {activeTab === 'controls' && (
             <div className="space-y-6">
                <ControlPanel 
                  simParams={simParams} setSimParams={setSimParams} 
                  aiPrompt={""} setAiPrompt={()=>{}} onExecuteAI={()=>{}} isAiLoading={false} 
                  isMuted={isMuted} onToggleMute={handleToggleMute} onSyncWeather={syncRealWeather}
                />
                <button 
                  onClick={() => {
                    triggerSimulation(simulationOrigin, loadingMapData);
                    setIsSidebarOpen(false); // Close drawer on mobile when running
                  }}
                  disabled={mutation.isPending} 
                  className="w-full bg-orange-600 p-4 rounded-lg font-bold flex items-center justify-center gap-3 hover:bg-orange-500 transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)]"
                >
                   {mutation.isPending ? <Loader2 className="animate-spin" /> : <Zap size={18} />} RUN PREDICTIVE MODEL
                </button>
             </div>
          )}
          {activeTab === 'impact' && (
            <RiskReport risks={filteredRisks} totalCount={riskReport.length} showAll={showAllLandmarks} routeStops={routeStops} // Pass state in
  setRouteStops={setRouteStops}onToggleView={() => setShowAllLandmarks(!showAllLandmarks)} searchTerm={searchTerm} onSearchChange={setSearchTerm} activeFilters={activeFilters} onToggleFilter={toggleFilter}/>
          )}
          {activeTab === 'location' && (
            <LocationPanel currentLat={viewport.latitude} currentLon={viewport.longitude} onLocationUpdate={(lat, lon) => handleLocationUpdate(lat, lon, isMapLoaded)} isSelectingOnMap={isSelectingOnMap} setIsSelectingOnMap={setIsSelectingOnMap}/>
          )}
        </div>

        {/* CHAT HUB */}
        <div className="h-[40%] md:h-[35%] flex flex-col flex-shrink-0 border-t border-white/10 bg-[#05050a] relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
           <div className="px-4 py-2 bg-[#0B1121] border-b border-white/5 text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={12}/> AI Command Interface
           </div>
           <div className="flex-1 overflow-hidden">
               <ImpactChat 
                  riskReport={riskReport}
                  onUpdateParams={(p) => setSimParams(prev => ({...prev, ...p}))}
                  onUpdateLocation={(lat, lon) => handleLocationUpdate(lat, lon, isMapLoaded)}
                  onTriggerSim={(overrides, forceQueue) => triggerSimulation(simulationOrigin, loadingMapData, overrides, forceQueue)}
                  isMapLoading={loadingMapData}
                  onPlanRoute={(assets) => {
                    setRouteStops(assets); // This fills the Route Plan list
                    setActiveTab('impact'); // This switches the sidebar so you can see it
                }}
              />
           </div>
        </div>
      </aside>

      {/* --- MAP SECTION --- */}
      <section className="relative h-full w-full bg-black z-10">
        
        {/* MOBILE TOGGLE BUTTON (Floating) */}
        <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden absolute top-4 left-4 z-40 bg-[#0f172a] text-white p-3 rounded-full shadow-xl border border-white/20 hover:bg-slate-800 transition-all active:scale-95"
        >
            <Menu size={24} />
        </button>

        <Map 
            ref={mapRef} {...viewport} onLoad={() => setIsMapLoaded(true)} 
            onMove={evt => setViewport(evt.viewState)} 
            onClick={(evt) => { 
                if(activeTab==='location'||isSelectingOnMap) setPendingLocation({lat:evt.lngLat.lat, lon:evt.lngLat.lng}); 
                // Close sidebar if clicking map on mobile
                setIsSidebarOpen(false);
            }}
            style={{ width: '100%', height: '100%' }} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN} cursor={isSelectingOnMap ? 'crosshair' : 'auto'}
        >
             {/* PENDING LOCATION POPUP */}
             {pendingLocation && (
                <Popup latitude={pendingLocation.lat} longitude={pendingLocation.lon} closeButton={false} closeOnClick={false} anchor="bottom" offset={10}>
                  <div className="p-2 bg-[#0a0e1a] rounded text-white min-w-[150px]">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Confirm Start Point?</div>
                    <div className="text-xs font-mono text-emerald-400 mb-3">{pendingLocation.lat.toFixed(4)}, {pendingLocation.lon.toFixed(4)}</div>
                    <div className="flex gap-2">
                      <button onClick={() => handleLocationUpdate(pendingLocation.lat, pendingLocation.lon, isMapLoaded)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1 rounded">CONFIRM</button>
                      <button onClick={() => setPendingLocation(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold py-1 rounded">CANCEL</button>
                    </div>
                  </div>
                </Popup>
              )}

              {/* MARKERS (Updated for Mobile Touch) */}
              {filteredMarkers.map((lm: any) => { 
                const isCritical = riskReport.find(r => r.id === lm.id);
                return (
                  <Marker key={lm.id} longitude={lm.lon} latitude={lm.lat} anchor="bottom">
                    <div 
                        className="group flex flex-col items-center cursor-pointer"
                        onMouseEnter={() => setHoverInfo(lm)} 
                        onMouseLeave={() => setHoverInfo(null)}
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent map click
                            setHoverInfo(lm); // Tap to show info on mobile
                        }}
                    >
                      <div className={`p-1.5 rounded-md border shadow-lg transition-all ${isCritical ? 'bg-red-600 border-red-400 scale-110 z-50 shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-[#0B1121]/90 border-white/10 text-slate-500 scale-75 hover:scale-100 hover:text-white'}`}>
                          {getLandmarkIcon(lm.type, 14)}
                      </div>
                    </div>
                  </Marker>
                )
              })}

              {/* HOVER TOOLTIP */}
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

              {/* HEATMAP */}
              {history.length > 0 && <Source type="geojson" data={fireData as any}><Layer id='fire-heat' type='heatmap' paint={{ 'heatmap-weight': ['get', 'intensity'], 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.1, 'rgba(50,0,0,0.5)', 0.3, 'rgb(100,0,0)', 0.6, 'rgb(255,100,0)', 1, 'rgb(255,255,200)'], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 15, 11, 25, 15, 50], 'heatmap-opacity': 0.80 }} /></Source>}
              
              <NavigationControl position="bottom-right" />
        </Map>
        
        {/* LOADING OVERLAY */}
        {loadingMapData && (
             <div className="absolute top-4 right-4 md:left-4 z-50 animate-in fade-in slide-in-from-top-4">
                <div className="bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl flex items-center gap-3">
                  <div className="p-2 rounded-md bg-amber-500/20 text-amber-400"><Loader2 size={16} className="animate-spin"/></div>
                  <div className="hidden md:flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GIS Uplink</span><span className="text-xs font-mono font-bold text-amber-400">INGESTING ASSETS...</span></div>
                </div>
             </div>
        )}

        {/* TIMELINE CONTROLS (Responsive) */}
        {history.length > 0 && (
          <div className="absolute bottom-6 md:bottom-8 left-4 right-4 md:left-8 md:right-16 bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-xl p-3 md:p-4 flex items-center gap-3 md:gap-4 shadow-2xl z-40 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all flex-shrink-0">{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest"><span>T-00:00</span><span className="text-orange-400 font-mono hidden md:inline">EST: T+{ (currentFrame * 0.5).toFixed(1) } HRS</span><span>T-{simParams.duration}H</span></div>
              <input type="range" min="0" max={history.length - 1} value={currentFrame} onChange={(e) => { setIsPlaying(false); setCurrentFrame(parseInt(e.target.value)); }} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
            </div>
            <button onClick={() => { setIsPlaying(false); setCurrentFrame(0); }} className="p-2 text-slate-500 hover:text-white transition-colors"><RefreshCw size={16} /></button>
          </div>
        )}
      </section>
    </main>
  );
}