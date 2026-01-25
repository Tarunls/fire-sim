import React, { useState } from 'react';
import { MapPin, Navigation, Globe, Crosshair, CheckCircle } from 'lucide-react';

interface LocationPanelProps {
  currentLat: number;
  currentLon: number;
  onLocationUpdate: (lat: number, lon: number) => void;
  isSelectingOnMap: boolean;
  setIsSelectingOnMap: (val: boolean) => void;
}

export default function LocationPanel({ 
  currentLat, currentLon, onLocationUpdate, 
  isSelectingOnMap, setIsSelectingOnMap 
}: LocationPanelProps) {
  
  const [inputLat, setInputLat] = useState(currentLat.toString());
  const [inputLon, setInputLon] = useState(currentLon.toString());
  const [gpsLoading, setGpsLoading] = useState(false);

  // --- METHOD 1: DEVICE GPS ---
  const handleGPS = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationUpdate(position.coords.latitude, position.coords.longitude);
        setGpsLoading(false);
      },
      () => {
        alert("Unable to retrieve your location");
        setGpsLoading(false);
      }
    );
  };

  // --- METHOD 2: MANUAL ENTRY ---
  const handleManualSubmit = () => {
    const lat = parseFloat(inputLat);
    const lon = parseFloat(inputLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      onLocationUpdate(lat, lon);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
      
      {/* HEADER */}
      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
        <h3 className="text-blue-400 font-bold text-sm flex items-center gap-2">
          <Globe size={16} /> Global Positioning
        </h3>
        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
          Relocate the Incident Command Center to a new theater of operations. 
          All GIS data will be re-ingested automatically.
        </p>
      </div>

      {/* METHOD 1: GPS BUTTON */}
      <button 
        onClick={handleGPS}
        disabled={gpsLoading}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
      >
        {gpsLoading ? <Navigation className="animate-spin" size={14}/> : <Navigation size={14} />}
        {gpsLoading ? "ACQUIRING SATELLITE FIX..." : "USE CURRENT DEVICE LOCATION"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#0B1121] px-2 text-slate-500">Or Manual Input</span></div>
      </div>

      {/* METHOD 2: COORDINATE INPUTS */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Latitude</label>
            <input 
              type="text" 
              value={inputLat} 
              onChange={(e) => setInputLat(e.target.value)}
              className="w-full bg-[#05050a] border border-white/10 rounded p-2 text-xs text-blue-200 font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Longitude</label>
            <input 
              type="text" 
              value={inputLon} 
              onChange={(e) => setInputLon(e.target.value)}
              className="w-full bg-[#05050a] border border-white/10 rounded p-2 text-xs text-blue-200 font-mono focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <button 
          onClick={handleManualSubmit}
          className="w-full border border-white/10 hover:bg-white/5 text-slate-300 p-2 rounded text-xs font-bold transition-all"
        >
          UPDATE COORDINATES
        </button>
      </div>

      {/* METHOD 3: MAP CLICK TOGGLE */}
      <div className={`p-4 rounded-xl border transition-all cursor-pointer ${isSelectingOnMap ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
           onClick={() => setIsSelectingOnMap(!isSelectingOnMap)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isSelectingOnMap ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
              <Crosshair size={16} />
            </div>
            <div>
              <div className={`text-xs font-bold ${isSelectingOnMap ? 'text-emerald-400' : 'text-white'}`}>
                {isSelectingOnMap ? "Targeting Active" : "Select on Map"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isSelectingOnMap ? "Click map to set zero-point" : "Click to enable visual targeting"}
              </div>
            </div>
          </div>
          {isSelectingOnMap && <div className="text-emerald-500 animate-pulse"><CheckCircle size={14}/></div>}
        </div>
      </div>

    </div>
  );
}