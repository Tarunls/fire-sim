import React from 'react';
import { Activity, Zap, AlertTriangle, GraduationCap, Building2, PlusSquare, FireExtinguisher } from 'lucide-react';

interface RiskReportProps {
  risks: any[];
  showAll: boolean;
  onToggleView: () => void;
}

export default function RiskReport({ risks, showAll, onToggleView }: RiskReportProps) {
  if (risks.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500 border-2 border-dashed border-white/5 rounded-xl animate-in fade-in zoom-in duration-300">
        <Activity className="mx-auto mb-2 opacity-50" />
        <p className="text-xs">No Critical Infrastructure <br/> currently projected to be impacted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
      {/* Map Visualization Toggle */}
      <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
        <span className="text-xs text-slate-400">Map Overlay</span>
        <button 
          onClick={onToggleView}
          className={`text-[10px] px-2 py-1 rounded border flex items-center gap-2 transition-all ${showAll ? 'bg-slate-700 text-white border-white/20' : 'bg-transparent text-slate-500 border-slate-700'}`}
        >
          {showAll ? 'Showing All Assets' : 'Highlighting Risks'}
        </button>
      </div>

      <div className="bg-red-500/10 rounded-xl border border-red-500/30 overflow-hidden shadow-lg shadow-red-900/20">
        <div className="bg-red-500/20 px-4 py-3 border-b border-red-500/30 flex justify-between items-center">
          <span className="text-xs font-bold text-red-200 uppercase tracking-wider flex items-center gap-2">
            <Activity size={14} className="animate-pulse text-red-400"/> Impact Timeline
          </span>
          <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm">{risks.length} ALERTS</span>
        </div>
        
        <div className="divide-y divide-red-500/10 max-h-[400px] overflow-y-auto custom-scrollbar">
          {risks.map((item, idx) => (
            <div key={idx} className="p-3 flex items-center justify-between hover:bg-red-500/5 transition-colors group">
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
    </div>
  );
}