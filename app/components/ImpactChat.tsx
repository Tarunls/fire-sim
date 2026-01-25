import React, { useState, useRef, useEffect } from 'react';
import { Send, Activity, PlusSquare, GraduationCap, Building2, FireExtinguisher, Loader2, Mic, MicOff } from 'lucide-react';
import { speak } from '../utils/elevenLabs';

interface ImpactChatProps {
  riskReport: any[];
  onUpdateParams: (params: any) => void;
  onUpdateLocation: (lat: number, lon: number) => void;
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
  
  // --- NATIVE BROWSER RECORDING STATE ---
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // --- 1. START LISTENING (Browser Native) ---
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Browser does not support Speech Recognition.");
        return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false; 
    recognitionRef.current.interimResults = true; 
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result) => result.transcript)
            .join('');
        
        setInput(transcript); // Show text while speaking

        // --- AUTO-SEND LOGIC ---
        if (event.results[0].isFinal) {
            stopListening();
            // Wait 800ms for user to see the text, then send automatically
            setTimeout(() => {
                handleSend(transcript); // <--- PASS TEXT DIRECTLY
            }, 800);
        }
    };

    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onerror = () => setIsListening(false);
    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
    }
  };

  const handleMicClick = () => {
      if (isListening) stopListening();
      else startListening();
  };

  // --- 2. SEND MESSAGE ---
  // Added optional 'overrideText' to support auto-send
  const handleSend = async (overrideText?: string) => {
     // Use overrideText if provided, otherwise use state input
     const textToSend = typeof overrideText === 'string' ? overrideText : input;
     
     if (!textToSend.trim()) return;
     
     setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
     setInput('');
     setLoading(true);

     try {
       const res = await fetch('http://127.0.0.1:8000/unified-chat', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ prompt: textToSend, risk_data: [] })
       });
       const data = await res.json();
       
       if (data.type === 'action') {
           const params = data.payload;
           onUpdateParams(params);
           let didMove = false;
           let speechText = "Parameters updated.";
           
           if (params.originLat && params.originLon) {
               onUpdateLocation(params.originLat, params.originLon);
               didMove = true;
               speechText = "Relocating sector. Simulation queued pending map data.";
           } else {
               speechText = "Parameters updated. Re-running predictive model.";
           }
           
           speak(speechText);
           setMessages(prev => [...prev, { role: 'bot', text: speechText, isAction: true }]);
           onTriggerSim(params, didMove);
       } else {
           const filters = data.payload;
           // Filter Logic (Same as before)
           const results = riskReport.filter(item => {
             const t = parseFloat(item.timeToImpact);
             const matchesTime = t >= (filters.min_time || 0) && t <= (filters.max_time || 999);
             const matchesType = (filters.asset_types?.length > 0) ? filters.asset_types.includes(item.type) : true;
             const matchesName = filters.name_query ? item.name.toLowerCase().includes(filters.name_query.toLowerCase()) : true;
             return matchesTime && matchesType && matchesName;
           });

           let speechText = "";
           if (results.length === 0) speechText = "I found no assets matching those criteria.";
           else {
               const firstTwo = results.slice(0, 2).map((r: any) => r.name).join(" and ");
               const remainder = results.length - 2;
               speechText = `I found ${results.length} matches. Including ${firstTwo}${remainder > 0 ? ` and ${remainder} others.` : "."}`;
           }
           speak(speechText);
           
           let finalReply = data.payload.ai_reply || "Analysis complete.";
           if (results.length > 0) finalReply = `Found ${results.length} matches.`;
           setMessages(prev => [...prev, { role: 'bot', text: finalReply, results: results }]);
       }
     } catch(err) {
        console.error(err);
        setMessages(prev => [...prev, { role: 'bot', text: "System Error." }]);
     } finally {
        setLoading(false);
     }
  };

  return (
    <div className="flex flex-col h-full bg-[#05050a] border-t border-white/10">
      {/* Messages */}
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
                            <div className="text-slate-400">{item.type === 'medical' ? <PlusSquare size={12}/> : <Building2 size={12}/>}</div>
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

      {/* Input Bar */}
      <div className="p-3 bg-[#0B1121] flex gap-2">
        <button 
            onClick={handleMicClick} 
            className={`p-3 rounded-lg transition-all ${
                isListening ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.6)]' 
                : 'bg-[#0f172a] text-slate-400 hover:text-white border border-white/10'
            }`}
        >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()} // Manual send still works
          placeholder={isListening ? "Listening..." : "Type a command..."}
          className="flex-1 bg-[#0f172a] border border-white/10 rounded-lg px-3 py-3 text-xs text-white focus:outline-none placeholder:text-slate-600"
        />
        <button onClick={() => handleSend()} disabled={loading || isMapLoading || isListening} className="bg-blue-600 p-3 rounded-lg text-white disabled:opacity-50"><Send size={16}/></button>
      </div>
    </div>
  );
}