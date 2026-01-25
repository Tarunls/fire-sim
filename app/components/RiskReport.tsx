import React from 'react';
import { 
  Activity, Zap, AlertTriangle, GraduationCap, Building2, 
  PlusSquare, FireExtinguisher, Search, Filter, X 
} from 'lucide-react';

interface RiskReportProps {
  // Data
  risks: any[]; // The filtered list to display
  totalCount: number; // Total critical items (for the badge)
  
  // View Controls
  showAll: boolean;
  onToggleView: () => void;

  // Search & Filter State (Passed from Parent)
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
}

export default function RiskReport({ 
  risks, totalCount, showAll, onToggleView,
  searchTerm, onSearchChange, activeFilters, onToggleFilter 
}: RiskReportProps) {

  // Categories config
  const categories = [
    { id: 'medical', label: 'Hospital/Clinic', icon: <PlusSquare size={12}/> },
    { id: 'power', label: 'Power', icon: <Zap size={12}/> },
    { id: 'school', label: 'Schools', icon: <GraduationCap size={12}/> },
    { id: 'response', label: 'Fire/Police', icon: <FireExtinguisher size={12}/> },
  ];

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
      
      {/* --- CONTROLS SECTION --- */}
      <div className="space-y-2">
        
        {/* 1. Map Visualization Toggle */}
        <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400">Map Overlay</span>
          <button 
            onClick={onToggleView}
            className={`text-[10px] px-2 py-1 rounded border flex items-center gap-2 transition-all ${showAll ? 'bg-slate-700 text-white border-white/20' : 'bg-transparent text-slate-500 border-slate-700'}`}
          >
            {showAll ? 'Showing All Assets' : 'Highlighting Risks'}
          </button>
        </div>

        {/* 2. Search Bar (Controlled) */}
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-slate-300 transition-colors" size={14} />
          <input 
            type="text" 
            placeholder="Search assets by name..." 
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#0B1121] border border-white/10 rounded-lg py-2 pl-9 pr-8 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2 text-slate-600 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 3. Filter Chips (Controlled) */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-slate-500 py-1 mr-1 flex items-center gap-1"><Filter size={10}/> Filters:</span>
          {categories.map(cat => {
            const isActive = activeFilters.has(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => onToggleFilter(cat.id)}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all border
                  ${isActive 
                    ? 'bg-slate-700 text-white border-slate-500 shadow-sm' 
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-white/5 hover:text-slate-400'}
                `}
              >
                {cat.icon}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- RESULTS LIST --- */}
      {risks.length === 0 && totalCount > 0 ? (
         <div className="p-6 text-center text-xs text-red-300/50 italic border border-white/5 rounded-xl">
           No alerts match your filter criteria.
         </div>
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
            <div className="flex gap-2">
               <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                 {risks.length} / {totalCount}
               </span>
            </div>
          </div>
          
          <div className="divide-y divide-red-500/10 max-h-[350px] overflow-y-auto custom-scrollbar">
            {risks.map((item, idx) => (
              <div key={item.id} className="p-3 flex items-center justify-between hover:bg-red-500/5 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0B1121] rounded-md border border-white/10 text-slate-400 group-hover:border-red-500/50 group-hover:text-red-400 transition-all">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-tight group-hover:text-red-200 transition-colors">{item.name}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-wide">{item.type}</div>
                  </div>
                </div>
                <div className="text-right">
                   <div className="text-sm font-black text-red-500 font-mono">T+{item.timeToImpact}h</div>
                   <div className="text-[8px] text-red-400/60 uppercase font-bold tracking-wider">Impact</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}