import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Activity, PlusSquare, GraduationCap, Building2, FireExtinguisher, Loader2 } from 'lucide-react';

interface ImpactChatProps {
  riskReport: any[];
  onUpdateParams: (params: any) => void;
  onUpdateLocation: (lat: number, lon: number) => void;
  // UPDATE: This function signature now accepts overrides
  onTriggerSim: (overrideParams?: any, forceQueue?: boolean) => void; 
  isMapLoading: boolean;
}

export default function ImpactChat({ 
  riskReport, 
  onUpdateParams, 
  onUpdateLocation, 
  onTriggerSim,
  isMapLoading 
}: ImpactChatProps) {
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { role: 'bot', text: 'Command Hub Online.' }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/unified-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg, risk_data: [] })
      });
      const data = await res.json();

      if (data.type === 'action') {
        const params = data.payload;
        
        // 1. Update UI State (Visual only)
        onUpdateParams(params);
        
        let didMove = false;
        if (params.originLat && params.originLon) {
            onUpdateLocation(params.originLat, params.originLon);
            didMove = true;
        }

        setMessages(prev => [...prev, { 
            role: 'bot', 
            text: didMove ? "Relocating sector. Simulation queued..." : "Parameters updated. Re-running model...", 
            isAction: true 
        }]);

        // 2. CRITICAL FIX: Pass new params DIRECTLY to the simulator.
        // We also pass 'didMove' as 'forceQueue'. 
        // If we moved, we force the queue to wait, even if map loading hasn't started yet.
        onTriggerSim(params, didMove); 

      } else {
        // ... (Knowledge logic remains same) ...
        const filters = data.payload;
        const results = riskReport.filter(item => {
            const t = parseFloat(item.timeToImpact);
            const matchesTime = t >= (filters.min_time || 0) && t <= (filters.max_time || 999);
            const matchesType = (filters.asset_types?.length > 0) ? filters.asset_types.includes(item.type) : true;
            const matchesName = filters.name_query ? item.name.toLowerCase().includes(filters.name_query.toLowerCase()) : true;
            return matchesTime && matchesType && matchesName;
        });
        
        let finalReply = data.payload.ai_reply;
        if (results.length === 0) finalReply = "No assets found matching criteria.";
        else if (results.length > 0) finalReply = `Found ${results.length} matches.`;

        setMessages(prev => [...prev, { role: 'bot', text: finalReply, results: results }]);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'bot', text: "System Error." }]);
    } finally {
      setLoading(false);
    }
  };

  // ... (Render matches previous step) ...
  return (
    // ... (Your existing JSX)
    <div className="flex flex-col h-full bg-[#05050a] border-t border-white/10">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] p-3 rounded-xl text-xs leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-300 rounded-bl-none border border-white/5'}`}>
               {m.isAction && <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 mb-1 border-b border-white/10 pb-1"><Activity size={10}/> EXECUTING SEQUENCE</div>}
               {m.text}
            </div>
            
            {m.results && m.results.length > 0 && (
              <div className="w-[90%] bg-white/5 border border-white/10 rounded-lg p-1 space-y-1">
                {m.results.slice(0, 5).map((item: any, i: number) => (
                   <div key={i} className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors">
                      <div className="flex items-center gap-2">
                         <div className="text-slate-400">
                           {item.type === 'medical' ? <PlusSquare size={12}/> : <Building2 size={12}/>}
                         </div>
                         <div className="text-[10px] text-slate-200 font-bold truncate max-w-[150px]">{item.name}</div>
                      </div>
                      <span className="text-[9px] font-mono text-red-400">T+{item.timeToImpact}h</span>
                   </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 p-3"><Loader2 size={12} className="animate-spin text-slate-500"/><span className="text-[10px] text-slate-500">Processing...</span></div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="p-3 bg-[#0B1121] flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a command..."
          className="flex-1 bg-[#0f172a] border border-white/10 rounded-lg px-3 py-3 text-xs text-white focus:outline-none"
        />
        <button onClick={handleSend} disabled={loading || isMapLoading} className="bg-blue-600 p-3 rounded-lg text-white disabled:opacity-50"><Send size={16}/></button>
      </div>
    </div>
  );
}