import React from 'react';
import { 
  Compass, Thermometer, Droplets, Mountain, Waves, Clock, 
  Terminal, Loader2, ChevronRight 
} from 'lucide-react';

interface ControlPanelProps {
  simParams: any;
  setSimParams: (params: any) => void;
  aiPrompt: string;
  setAiPrompt: (val: string) => void;
  onExecuteAI: () => void;
  isAiLoading: boolean;
}

export default function ControlPanel({
  simParams, setSimParams, aiPrompt, setAiPrompt, onExecuteAI, isAiLoading
}: ControlPanelProps) {
  
  const compassGrid = ['NW', 'N', 'NE', 'W', '', 'E', 'SW', 'S', 'SE'];

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
      
      {/* --- SLIDERS SECTION --- */}
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
        
        {/* TEMPERATURE */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex justify-between text-xs mb-2"><span className="flex items-center gap-1"><Thermometer size={12}/> Temperature</span><span className="text-red-400 font-mono">{simParams.temperature}°F</span></div>
            <input type="range" min="30" max="120" value={simParams.temperature} onChange={(e) => setSimParams({...simParams, temperature: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-red-500" />
        </div>

        {/* HUMIDITY */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="flex justify-between text-xs mb-2"><span className="flex items-center gap-1"><Droplets size={12}/> Humidity</span><span className="text-blue-400 font-mono">{simParams.humidity}%</span></div>
          <input type="range" min="0" max="100" value={simParams.humidity} onChange={(e) => setSimParams({...simParams, humidity: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-blue-500" />
        </div>

        {/* SLOPE */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="flex justify-between text-xs mb-2"><span className="flex items-center gap-1"><Mountain size={12}/> Gradient Slope</span><span className="text-emerald-400 font-mono">{simParams.slope}°</span></div>
          <input type="range" min="0" max="45" value={simParams.slope} onChange={(e) => setSimParams({...simParams, slope: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-emerald-500" />
        </div>

        {/* MOISTURE */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="flex justify-between text-xs mb-2"><span className="flex items-center gap-1"><Waves size={12}/> Fuel Moisture</span><span className="text-cyan-400 font-mono">{simParams.moisture}%</span></div>
          <input type="range" min="0" max="100" value={simParams.moisture} onChange={(e) => setSimParams({...simParams, moisture: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-cyan-500" />
        </div>

        {/* DURATION */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="flex justify-between text-xs mb-2"><span className="flex items-center gap-1"><Clock size={12}/> Prediction Window</span><span className="text-purple-400 font-mono">{simParams.duration} HRS</span></div>
            <input type="range" min="2" max="96" step="2" value={simParams.duration} onChange={(e) => setSimParams({...simParams, duration: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 accent-purple-500" />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tighter"><span>Immediate</span><span>Extended</span></div>
        </div>
      </div>

      {/* --- AI TERMINAL SECTION --- */}
      <div className="space-y-3 px-4 py-3 border border-white/5 bg-black/20 rounded-xl">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal size={12} /> Neural Input
          </label>
          {isAiLoading && <Loader2 size={12} className="text-purple-500 animate-spin" />}
        </div>
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg blur opacity-10 group-hover:opacity-25 transition"></div>
          <div className="relative bg-[#05050a] rounded-lg border border-white/10 overflow-hidden">
            <textarea 
              value={aiPrompt} 
              onChange={(e) => setAiPrompt(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onExecuteAI())} 
              className="w-full bg-transparent p-3 text-xs text-slate-300 placeholder:text-slate-600 font-mono outline-none resize-none leading-relaxed" 
              placeholder="e.g. 'Simulate a fast moving fire towards the hospital...'" 
              rows={3} 
            />
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-t border-white/5">
              <span className="text-[9px] text-slate-500 font-mono italic">{isAiLoading ? "PARSING..." : "READY"}</span>
              <button onClick={onExecuteAI} className="flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 transition">
                EXECUTE <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}