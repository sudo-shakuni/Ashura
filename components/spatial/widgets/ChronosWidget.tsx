'use client';

import React, { useState, useEffect } from 'react';

interface ChronosWidgetProps {
  activeTimer?: {
    totalSec: number;
    remainingSec: number;
    label: string;
    onDismiss: () => void;
  } | null;
}

export function ChronosWidget({ activeTimer }: ChronosWidgetProps) {
  const [time, setTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return (
      <div className="flex items-center justify-center h-full text-xs font-mono text-cyan-400/60 animate-pulse">
        CALIBRATING CHRONOS...
      </div>
    );
  }

  const hours = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <div 
        className="text-4xl font-extralight tracking-wider text-white font-mono"
        style={{ textShadow: '0 0 16px rgba(0, 240, 255, 0.6), 0 0 30px rgba(0, 240, 255, 0.3)' }}
      >
        {hours}
      </div>
      
      <div className="text-cyan-400 text-xs font-semibold tracking-widest uppercase font-mono bg-cyan-950/40 px-2.5 py-0.5 rounded border border-cyan-500/30">
        {dateStr}
      </div>

      {/* Active Timer Indicator */}
      {activeTimer && activeTimer.remainingSec > 0 && (
        <div className="w-full mt-2 p-2 rounded bg-cyan-950/60 border border-cyan-500/40 flex flex-col gap-1 text-xs">
          <div className="flex justify-between items-center text-cyan-300 font-mono font-bold">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              TIMER: {activeTimer.label}
            </span>
            <span className="text-yellow-400">
              {Math.floor(activeTimer.remainingSec / 60)}:
              {String(activeTimer.remainingSec % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-yellow-400 h-full transition-all duration-1000"
              style={{ width: `${(activeTimer.remainingSec / Math.max(1, activeTimer.totalSec)) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
