'use client';

import React from 'react';
import { Play, Pause, Radio } from 'lucide-react';

interface VideoPlayerWidgetProps {
  videoId: string;
  title: string;
  isPlaying: boolean;
  onSelectPreset: (id: string, title: string) => void;
  onTogglePlay: () => void;
}

export function VideoPlayerWidget({
  videoId,
  title,
  isPlaying,
  onSelectPreset,
  onTogglePlay,
}: VideoPlayerWidgetProps) {
  const presets = [
    { id: 'jfKfPfyJRdk', title: 'Lofi Beats', label: '☕ LOFI' },
    { id: '4xDzrJKXOOY', title: 'Synthwave Radio', label: '🌆 SYNTH' },
    { id: 'S4L8T2kFFck', title: 'Cyberpunk Ambient', label: '⚡ CYBER' },
    { id: 'kgx4WGK0oNU', title: 'Deep Space Focus', label: '🌌 AMBIENT' },
  ];

  return (
    <div className="flex flex-col h-full gap-2.5 font-mono text-xs">
      {/* Video Stream Presets */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {presets.map((p) => {
          const isActive = videoId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPreset(p.id, p.title)}
              className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-1 ${
                isActive
                  ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                  : 'bg-cyan-950/40 border border-cyan-500/20 text-cyan-400/80 hover:bg-cyan-900/40'
              }`}
            >
              <Radio className="w-2.5 h-2.5" />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Video Frame */}
      <div className="flex-1 w-full bg-black/60 rounded-lg border border-cyan-500/30 overflow-hidden relative min-h-[160px]">
        {videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&enablejsapi=1&rel=0`}
            title={title}
            className="w-full h-full border-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex items-center justify-center h-full text-cyan-500/50 text-xs">
            SELECT A CYBER STREAM ABOVE
          </div>
        )}
      </div>

      {/* Current Title & Status */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] text-cyan-300 font-sans truncate max-w-[200px]">
          {title || 'Cyber Radio Offline'}
        </span>
        <button
          type="button"
          onClick={onTogglePlay}
          className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 flex items-center gap-1 text-[10px] font-bold"
        >
          {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>
      </div>
    </div>
  );
}
