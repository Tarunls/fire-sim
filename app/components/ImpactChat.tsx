import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Clock, PlusSquare, Zap, FireExtinguisher, GraduationCap, Building2, Loader2, Volume2 } from 'lucide-react'; // Added Volume2 for future voice

interface ImpactChatProps {
  riskReport: any[]; 
}

interface Message {
  role: 'user' | 'bot';
  text: string;
  ids?: number[]; // IDs to highlight
}

export default function ImpactChat({ riskReport }: ImpactChatProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Intelligence Core Online. I have read the current impact report. You can ask me specific questions like "Is Rock Prairie Elementary safe?" or "What hits in the next hour?"' }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      // --- RAG: SEND DATA TO AI ---
      const res = await fetch('http://127.0.0.1:8000/query-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            prompt: userMsg,
            risk_data: riskReport // <--- SENDING THE "DATABASE"
        })
      });
      
      const data = await res.json();
      const aiResponse = data.response;

      setMessages(prev => [...prev, { 
          role: 'bot', 
          text: aiResponse.answer, 
          ids: aiResponse.highlight_ids 
      }]);

    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Uplink failed. Unable to query backend." }]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to find specific items in the report for display
  const getReferencedItems = (ids?: number[]) => {
      if (!ids || ids.length === 0) return [];
      return riskReport.filter(r => ids.includes(r.id));
  };

  return (
    <div className="flex flex-col h-full bg-[#05050a] rounded-xl border border-white/10 overflow-hidden animate-in fade-in">
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            
            <div className={`max-w-[90%] p-3 rounded-xl text-xs leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-300 rounded-bl-none border border-white/5'}`}>
              <div className="flex items-center justify-between mb-1 opacity-50 font-bold uppercase tracking-wider text-[9px]">
                <span className="flex items-center gap-2">{m.role === 'user' ? <User size={10}/> : <Bot size={10}/>} {m.role === 'user' ? 'COMMANDER' : 'SYSTEM'}</span>
                {m.role === 'bot' && <Volume2 size={10} className="hover:text-white cursor-pointer"/>} {/* Future Voice Trigger */}
              </div>
              {m.text}
            </div>

            {/* DYNAMIC DATA CARDS */}
            {/* The AI told us which IDs are relevant. We fetch them from the prop to display cards. */}
            {m.ids && m.ids.length > 0 && (
              <div className="w-full bg-white/5 border border-white/10 rounded-lg p-1 space-y-1">
                {getReferencedItems(m.ids).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors group cursor-default">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded bg-black/40 border border-white/10 text-slate-400 group-hover:text-white group-hover:border-white/30 transition-all`}>
                        {item.type === 'medical' ? <PlusSquare size={14}/> : 
                         item.type === 'power' ? <Zap size={14}/> :
                         item.type === 'school' ? <GraduationCap size={14}/> : <Building2 size={14}/>}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-200 group-hover:text-blue-300 transition-colors">{item.name}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">{item.type} Asset</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-[10px] font-bold text-red-400 font-mono">T+{item.timeToImpact}H</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl w-fit"><Loader2 size={14} className="animate-spin text-blue-400"/><span className="text-[10px] text-slate-400 animate-pulse">Analyzing vector data...</span></div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="p-3 bg-[#0B1121] border-t border-white/10 flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about specific assets (e.g. 'Is Rock Prairie impacted?')"
          className="flex-1 bg-[#05050a] border border-white/10 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600"
        />
        <button onClick={handleSend} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}