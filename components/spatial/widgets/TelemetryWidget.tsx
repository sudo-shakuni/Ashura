'use client';

import React, { useState, useEffect } from 'react';

interface TelemetryWidgetProps {
  currentProvider?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  fps?: number;
}

export function TelemetryWidget({
  currentProvider = 'gemini',
  isListening = false,
  isSpeaking = false,
  fps = 60,
}: TelemetryWidgetProps) {
  const [ramUsage, setRamUsage] = useState(42);
  const [cpuUsage, setCpuUsage] = useState(28);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    // Dynamic simulated hardware fluctuations around nominal levels
    const interval = setInterval(() => {
      setCpuUsage(prev => {
        const delta = (Math.random() - 0.48) * 8;
        return Math.min(95, Math.max(12, Math.round(prev + delta)));
      });
      setRamUsage(prev => {
        const delta = (Math.random() - 0.5) * 3;
        return Math.min(88, Math.max(30, Math.round(prev + delta)));
      });
    }, 2500);

    // Read real battery if supported
    interface BatteryManager {
      level: number;
      addEventListener: (type: string, listener: () => void) => void;
    }
    const navWithBattery = navigator as unknown as { getBattery?: () => Promise<BatteryManager> };
    if (typeof navWithBattery !== 'undefined' && typeof navWithBattery.getBattery === 'function') {
      navWithBattery.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-3 font-mono text-xs">
      {/* AI Brain Status Bar */}
      <div className="flex justify-between items-center p-2 rounded bg-cyan-950/40 border border-cyan-500/20">
        <span className="text-cyan-400/80 font-bold uppercase">BRAIN CORE</span>
        <span className="text-cyan-200 font-bold bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/40">
          {currentProvider.toUpperCase()}
        </span>
      </div>

      {/* CPU Progress Bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-cyan-400/80">CPU LOAD</span>
          <span className={cpuUsage > 75 ? "text-amber-400" : "text-emerald-400"}>{cpuUsage}%</span>
        </div>
        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-cyan-500/20">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(0,240,255,0.5)]"
            style={{ width: `${cpuUsage}%` }}
          />
        </div>
      </div>

      {/* RAM Allocation */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-cyan-400/80">MEMORY (RAM)</span>
          <span className="text-cyan-300">{ramUsage}% ({((ramUsage / 100) * 16).toFixed(1)} GB)</span>
        </div>
        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-cyan-500/20">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
            style={{ width: `${ramUsage}%` }}
          />
        </div>
      </div>

      {/* Telemetry Matrix Grid */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/20 flex flex-col">
          <span className="text-[10px] text-cyan-500/80 font-semibold">FPS RATE</span>
          <span className="text-sm font-bold text-cyan-200">{fps} FPS</span>
        </div>
        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/20 flex flex-col">
          <span className="text-[10px] text-cyan-500/80 font-semibold">AUDIO LINK</span>
          <span className={`text-sm font-bold ${isSpeaking ? "text-cyan-300" : isListening ? "text-yellow-300" : "text-gray-400"}`}>
            {isSpeaking ? "SPEAKING" : isListening ? "LISTENING" : "STANDBY"}
          </span>
        </div>
        {batteryLevel !== null && (
          <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/20 flex flex-col col-span-2">
            <span className="text-[10px] text-cyan-500/80 font-semibold">BATTERY STATUS</span>
            <span className="text-sm font-bold text-emerald-300">{batteryLevel}% POWER</span>
          </div>
        )}
      </div>
    </div>
  );
}
