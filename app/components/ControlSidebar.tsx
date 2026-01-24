"use client";
import React, { useState, useRef, useEffect } from 'react';
import { 
  Wind, Droplets, Terminal, Crosshair, 
  Play, Loader2, Flame, AlertTriangle, Activity 
} from 'lucide-react';

const FUEL_MODELS = [
  { id: 'FM1', name: 'Short Grass', desc: 'Rapid spread, Low intensity', code: 'GR1' },
  { id: 'FM4', name: 'Chaparral', desc: 'High intensity, Deep flame', code: 'SH4' },
  { id: 'FM10', name: 'Timber Litter', desc: 'Slow spread, Compact bed', code: 'TL3' },
  { id: 'FM13', name: 'Heavy Slash', desc: 'Extreme heat, Long residence', code: 'SB3' },
];

export function ControlSidebar({ simParams, setSimParams, onRun, isLoading }: any) {
  const [command, setCommand] = useState('');
  const [aiLog, setAiLog] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [aiLog]);

  const handleAI = async () => {
    if (!command.trim()) return;
    setAiLog(prev => [...prev, `> ${command}`]);
    const cmd = command;
    setCommand('');
    
    try {
      const res = await fetch('http://127.0.0.1:8000/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cmd })
      });
      const data = await res.json();
      setSimParams(data.params);
      setAiLog(prev => [...prev, `SYSTEM: ${data.ai_response}`]);
    } catch (e) {
      setAiLog(prev => [...prev, `ERROR: Uplink failed.`]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-[#0f172a]">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <AlertTriangle className="text-orange-500" size={20} />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold tracking-tight">INCIDENT COMMAND</h1>
            <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Physics Engine v2.0</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
           <div className="flex items-center gap-2 p-2 bg-slate-900/80 rounded border border-slate-800">
             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
             <span className="text-[10px] font-bold text-emerald-500 tracking-wide">ONLINE</span>
           </div>
           <div className="flex items-center gap-2 p-2 bg-slate-900/80 rounded border border-slate-800">
             <Activity size={12} className="text-cyan-500" />
             <span className="text-[10px] font-bold text-cyan-500 tracking-wide">12ms</span>
           </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-700">
        
        {/* AI Terminal */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Terminal size={14} /> AI Operator
          </div>
          <div className="bg-black/50 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-48 shadow-inner">
            <div ref={scrollRef} className="flex-1 p-3 font-mono text-[11px] space-y-1 overflow-y-auto text-slate-300">
              <div className="text-slate-500 italic">Ready for input...</div>
              {aiLog.map((log, i) => (
                <div key={i} className={log.startsWith('>') ? 'text-cyan-400' : 'text-emerald-400 border-l-2 border-emerald-900 pl-2'}>{log}</div>
              ))}
            </div>
            <div className="p-2 bg-slate-900/50 border-t border-slate-800 flex items-center gap-2">
              <span className="text-cyan-500 text-xs font-mono">{'>'}</span>
              <input 
                className="bg-transparent w-full text-xs text-white font-mono outline-none"
                placeholder="Type command..."
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAI()}
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
           {/* Wind Speed */}
           <div className="space-y-3">
             <div className="flex justify-between items-end">
               <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><Wind size={14}/> WIND SPEED</label>
               <span className="text-sm font-mono font-bold text-cyan-400">{simParams.windSpeed} MPH</span>
             </div>
             <input type="range" min="0" max="100" value={simParams.windSpeed} onChange={(e) => setSimParams({...simParams, windSpeed: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg accent-cyan-500 cursor-pointer" />
           </div>

           {/* Direction */}
           <div className="space-y-3">
             <div className="flex justify-between items-end">
               <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><Crosshair size={14}/> DIRECTION</label>
               <span className="text-sm font-mono font-bold text-cyan-400">{simParams.windDir}°</span>
             </div>
             <input type="range" min="0" max="360" value={simParams.windDir} onChange={(e) => setSimParams({...simParams, windDir: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg accent-cyan-500 cursor-pointer" />
           </div>

           {/* Moisture */}
           <div className="space-y-3">
             <div className="flex justify-between items-end">
               <label className="text-xs font-bold text-slate-400 flex items-center gap-2"><Droplets size={14}/> MOISTURE</label>
               <span className="text-sm font-mono font-bold text-cyan-400">{simParams.moisture}%</span>
             </div>
             <input type="range" min="0" max="40" value={simParams.moisture} onChange={(e) => setSimParams({...simParams, moisture: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg accent-cyan-500 cursor-pointer" />
           </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-slate-800 bg-[#0f172a]">
        <button 
          onClick={onRun}
          disabled={isLoading}
          className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 text-white font-bold h-12 rounded flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
          <span className="tracking-wider text-sm">INITIATE SIMULATION</span>
        </button>
      </div>
    </div>
  );
}