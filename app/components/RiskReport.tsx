import React, { useState } from 'react';
import { 
  Activity, Zap, GraduationCap, Building2, PlusSquare, FireExtinguisher, 
  Search, Filter, X, MapPin, Navigation, ArrowUp, ArrowDown
} from 'lucide-react';

interface RiskReportProps {
  risks: any[];
  totalCount: number;
  showAll: boolean;
  onToggleView: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
  routeStops: any[];
  setRouteStops: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function RiskReport({ 
  risks, totalCount, showAll, onToggleView,
  searchTerm, onSearchChange, activeFilters, onToggleFilter, routeStops, setRouteStops
}: RiskReportProps) {

  // Toggle Selection
  const handleSelectForRoute = (item: any) => {
    if (routeStops.find(r => r.id === item.id)) {
      setRouteStops(prev => prev.filter(r => r.id !== item.id)); 
    } else {
      setRouteStops(prev => [...prev, item]); 
    }
  };

  // Move Item Up/Down
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newStops = [...routeStops];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStops.length) return;
    
    [newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]];
    setRouteStops(newStops);
  };

  // Launch Google Maps
  const handleLaunchRoute = () => {
    if (routeStops.length === 0) return;
    const waypoints = routeStops.map(stop => `${stop.lat},${stop.lon}`).join('/');
    const url = `https://www.google.com/maps/dir//${waypoints}`; 
    window.open(url, '_blank');
  };

  const categories = [
    { id: 'medical', label: 'Hospital/Clinic', icon: <PlusSquare size={12}/> },
    { id: 'power', label: 'Power', icon: <Zap size={12}/> },
    { id: 'school', label: 'Schools', icon: <GraduationCap size={12}/> },
    { id: 'response', label: 'Fire/Police', icon: <FireExtinguisher size={12}/> },
  ];

  return (
    // REMOVED 'h-full flex flex-col' to fix scrolling issues
    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300 pb-10"> 
      
      {/* --- CONTROLS SECTION --- */}
      <div className="space-y-2">
        
        {/* Route Planner Panel */}
        {routeStops.length > 0 && (
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-3 space-y-2 animate-in slide-in-from-top-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-blue-300 uppercase flex items-center gap-2">
                        <Navigation size={12} /> Active Route Plan ({routeStops.length})
                    </span>
                    <button onClick={() => setRouteStops([])} className="text-[10px] text-slate-400 hover:text-white">Clear</button>
                </div>
                
                <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                    {routeStops.map((stop, idx) => (
                        <div key={stop.id} className="flex items-center justify-between bg-[#0B1121] border border-blue-500/20 p-2 rounded">
                            <div className="flex items-center gap-2 truncate">
                                <span className="text-[10px] font-mono text-blue-400 font-bold">{idx + 1}.</span>
                                <span className="text-[10px] text-slate-200 truncate max-w-[120px]">{stop.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => moveItem(idx, 'up')} disabled={idx === 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ArrowUp size={10} className="text-slate-400"/></button>
                                <button onClick={() => moveItem(idx, 'down')} disabled={idx === routeStops.length - 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ArrowDown size={10} className="text-slate-400"/></button>
                                <button onClick={() => handleSelectForRoute(stop)} className="p-1 hover:bg-red-500/20 rounded group"><X size={10} className="text-slate-500 group-hover:text-red-400"/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={handleLaunchRoute}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
                >
                    <MapPin size={14} /> LAUNCH GOOGLE MAPS
                </button>
            </div>
        )}

        {/* Standard Controls */}
        <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400">Map Overlay</span>
          <button 
            onClick={onToggleView}
            className={`text-[10px] px-2 py-1 rounded border flex items-center gap-2 transition-all ${showAll ? 'bg-slate-700 text-white border-white/20' : 'bg-transparent text-slate-500 border-slate-700'}`}
          >
            {showAll ? 'Showing All Assets' : 'Highlighting Risks'}
          </button>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-slate-300 transition-colors" size={14} />
          <input 
            type="text" 
            placeholder="Search assets by name..." 
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#0B1121] border border-white/10 rounded-lg py-2 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 transition-all"
          />
          {searchTerm && <button onClick={() => onSearchChange('')} className="absolute right-2 top-2 text-slate-600 hover:text-white"><X size={14} /></button>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onToggleFilter(cat.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${activeFilters.has(cat.id) ? 'bg-slate-700 text-white border-slate-500' : 'bg-transparent text-slate-600 border-transparent hover:bg-white/5'}`}
              >
                {cat.icon} {cat.label}
              </button>
          ))}
        </div>
      </div>

      {/* --- RESULTS LIST --- */}
      {risks.length === 0 && totalCount > 0 ? (
          <div className="p-6 text-center text-xs text-red-300/50 italic border border-white/5 rounded-xl">No alerts match your filter criteria.</div>
      ) : risks.length === 0 ? (
        <div className="text-center py-10 text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
          <Activity className="mx-auto mb-2 opacity-50" />
          <p className="text-xs">No Critical Infrastructure <br/> currently projected to be impacted.</p>
        </div>
      ) : (
        <div className="bg-red-500/10 rounded-xl border border-red-500/30 overflow-hidden shadow-lg shadow-red-900/20">
          <div className="bg-red-500/20 px-4 py-3 border-b border-red-500/30 flex justify-between items-center">
            <span className="text-xs font-bold text-red-200 uppercase tracking-wider flex items-center gap-2">
              <Activity size={14} className="animate-pulse text-red-400"/> Impact Timeline
            </span>
            <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">{risks.length} / {totalCount}</span>
          </div>
          
          {/* RESTORED max-height here to ensure scrolling works */}
          <div className="divide-y divide-red-500/10 max-h-[400px] overflow-y-auto custom-scrollbar">
            {risks.map((item, idx) => {
              const isSelected = routeStops.some(r => r.id === item.id);
              return (
                <div 
                    key={item.id} 
                    onClick={() => handleSelectForRoute(item)}
                    className={`p-3 flex items-center justify-between transition-colors cursor-pointer group ${isSelected ? 'bg-blue-900/20 border-l-2 border-blue-500' : 'hover:bg-red-500/5 border-l-2 border-transparent'}`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600 bg-transparent text-transparent group-hover:border-slate-400'}`}>
                            <Navigation size={10} />
                        </div>
                        <div>
                            <div className={`text-xs font-bold leading-tight transition-colors ${isSelected ? 'text-blue-200' : 'text-white group-hover:text-red-200'}`}>{item.name}</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wide">{item.type}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-black text-red-500 font-mono">T+{item.timeToImpact}h</div>
                    </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}