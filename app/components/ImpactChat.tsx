import React, { useState, useRef, useEffect } from 'react';
import { Send, Activity, PlusSquare, GraduationCap, Building2, FireExtinguisher, Loader2, Mic, MicOff } from 'lucide-react';
import { speak } from '../utils/elevenLabs';

interface ImpactChatProps {
  riskReport: any[];
  onUpdateParams: (params: any) => void;
  onUpdateLocation: (lat: number, lon: number) => void;
  onTriggerSim: (overrideParams?: any, forceQueue?: boolean) => void;
  isMapLoading: boolean;
  onPlanRoute: (assets: any[]) => void;
}

export default function ImpactChat({ 
  riskReport, 
  onUpdateParams, 
  onUpdateLocation, 
  onTriggerSim,
  isMapLoading,
  onPlanRoute 
}: ImpactChatProps) {
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { role: 'bot', text: 'Command Hub Online.' }
  ]);
  
  // State to track if we have already summarized the current report
  // This prevents it from repeating itself if the component re-renders
  const [lastReportLen, setLastReportLen] = useState(0);

  // --- AUTO-SUMMARY: Watch for new Risk Reports ---
  useEffect(() => {
    // 1. Check if we have a NEW, populated report
    if (riskReport.length > 0 && riskReport.length !== lastReportLen) {
        
        // 2. Generate Statistics
        const count = riskReport.length;
        const medical = riskReport.filter(r => r.type === 'medical').length;
        const schools = riskReport.filter(r => r.type === 'school').length;
        const power = riskReport.filter(r => r.type === 'power').length;

        // 3. Construct the "Overview" Message
        let summary = `Simulation complete. Detected ${count} impacted assets.`;
        
        const details = [];
        if (medical > 0) details.push(`${medical} medical facilities`);
        if (schools > 0) details.push(`${schools} schools`);
        if (power > 0) details.push(`${power} power stations`);

        if (details.length > 0) {
            summary += ` Including ${details.join(', ')}.`;
        }

        // 4. Send to Chat & Speak
        // We add a small delay so it doesn't happen the exact millisecond the map appears
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                role: 'bot', 
                text: summary, 
                // We attach the full report here so the user can click/expand if they want
                results: riskReport 
            }]);
            speak(summary);
        }, 1000);

        // Update tracker so we don't say it again until the count changes
        setLastReportLen(count);
    } 
    // Reset tracker if report is cleared (new sim started)
    else if (riskReport.length === 0 && lastReportLen !== 0) {
        setLastReportLen(0);
    }
  }, [riskReport, lastReportLen]);


  // --- NATIVE BROWSER RECORDING STATE ---
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // --- START LISTENING ---
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
        
        setInput(transcript); 

        // Auto-Send on finish
        if (event.results[0].isFinal) {
            stopListening();
            setTimeout(() => {
                handleSend(transcript);
            }, 800);
        }
    };

    recognitionRef.current.onend = () => setIsListening(false);
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

  // --- SEND MESSAGE ---
  const handleSend = async (overrideText?: string) => {
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

       if (data.type === 'specific_route') {
            const requestedNames = data.payload.names; // ["Woodrow Wilson", "Star Hospital"]
            
            // We look through the REAL data objects in the riskReport
            const matchedAssets = riskReport.filter(asset => 
                requestedNames.some((name: string) => 
                    asset.name.toLowerCase().includes(name.toLowerCase())
                )
            );

            if (matchedAssets.length > 0) {
                // This is the function we passed from page.tsx
                onPlanRoute(matchedAssets); 
                
                const namesFound = matchedAssets.map(a => a.name).join(', ');
                const reply = `I've staged a route for: ${namesFound}. You can launch it from the Impact tab.`;
                
                setMessages(prev => [...prev, { role: 'bot', text: reply }]);
                speak(reply);
            } else {
                speak("I found the names, but they don't seem to be in the current impact zone.");
            }
        }
       
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
          onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
          placeholder={isListening ? "Listening..." : "Type a command..."}
          className="flex-1 bg-[#0f172a] border border-white/10 rounded-lg px-3 py-3 text-xs text-white focus:outline-none placeholder:text-slate-600"
        />
        <button onClick={() => handleSend()} disabled={loading || isMapLoading || isListening} className="bg-blue-600 p-3 rounded-lg text-white disabled:opacity-50"><Send size={16}/></button>
      </div>
    </div>
  );
}