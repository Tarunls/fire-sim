import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';

export function useSimulation() {
  const [simParams, setSimParams] = useState({
    windSpeed: 50, windDir: 'NW', moisture: 10, humidity: 20, 
    temperature: 95, slope: 15, duration: 24 
  });
  
  const [history, setHistory] = useState<any[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Queue State
  const [isSimQueued, setIsSimQueued] = useState(false);
  const [queuedConfig, setQueuedConfig] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      // console.log("🔥 FIRING SIMULATION API:", payload); 
      const res = await fetch('http://127.0.0.1:8000/simulate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      return res.json();
    },
    onSuccess: (data) => {
      setHistory(data.data);
      setCurrentFrame(0);
      setIsPlaying(true);
    }
  });

  // --- TRIGGER FUNCTION (FIXED) ---
  const triggerSimulation = (origin: {lat: number, lon: number}, isMapLoading: boolean, overrideParams?: any, forceQueue: boolean = false) => {
    
    // 1. Merge State with AI Overrides
    const mergedParams = { ...simParams, ...overrideParams };

    // 2. INTELLIGENT COORDINATE SELECTION
    // If the AI gave us specific coordinates (in overrideParams), use them!
    // Otherwise, fall back to the Page's 'origin' state.
    const finalLat = overrideParams?.originLat ?? origin.lat;
    const finalLon = overrideParams?.originLon ?? origin.lon;

    const finalConfig = {
        ...mergedParams,
        originLat: finalLat,
        originLon: finalLon
    };

    if (isMapLoading || forceQueue) {
        console.log("⏳ Queuing Simulation for:", finalLat, finalLon);
        setQueuedConfig(finalConfig);
        setIsSimQueued(true);
    } else {
        console.log("✅ Ready. Running immediately at:", finalLat, finalLon);
        mutation.mutate(finalConfig);
    }
  };

  // --- QUEUE WATCHER ---
  const notifyMapLoaded = () => {
      if (isSimQueued && queuedConfig) {
          console.log("🚀 Map Loaded! Executing queued simulation.");
          mutation.mutate(queuedConfig);
          setIsSimQueued(false);
          setQueuedConfig(null);
      }
  };

  // Animation Loop
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (isPlaying && history.length > 0) {
      animationRef.current = setTimeout(() => {
        setCurrentFrame((prev) => { 
          if (prev >= history.length - 1) { setIsPlaying(false); return prev; } 
          return prev + 1; 
        });
      }, 100);
    }
    return () => clearTimeout(animationRef.current as NodeJS.Timeout);
  }, [isPlaying, currentFrame, history]);

  const fireData = useMemo(() => {
    let activePoints = (history.length > 0 && history[currentFrame]) ? history[currentFrame] : [];
    if (!Array.isArray(activePoints)) activePoints = [];
    return { 
      type: 'FeatureCollection', 
      features: activePoints.map((point: any) => ({ 
        type: 'Feature', 
        geometry: { type: 'Point', coordinates: [point.lon, point.lat] }, 
        properties: { intensity: point.intensity } 
      })) 
    };
  }, [history, currentFrame]);

  return {
    simParams, setSimParams,
    history, setHistory,
    currentFrame, setCurrentFrame,
    isPlaying, setIsPlaying,
    mutation, fireData,
    triggerSimulation, notifyMapLoaded, isSimQueued
  };
}