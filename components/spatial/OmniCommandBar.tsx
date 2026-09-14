'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Plus, 
  Clock, 
  Activity, 
  Cpu, 
  Edit3, 
  Video, 
  Gamepad2, 
  Mic, 
  MicOff, 
  Eye, 
  Monitor, 
  Music,
  LayoutGrid
} from 'lucide-react';
import { useWidgetStore, WidgetType } from '@/store/useWidgetStore';

interface OmniCommandBarProps {
  onCommand: (cmd: string) => void;
  isVoiceActive: boolean;
  onToggleVoice: () => void;
  onScanCamera: () => void;
  onScanScreen: () => void;
  onTriggerDance: () => void;
  onToggleSpatialMode: () => void;
  spatialMode: boolean;
  visionScanning: boolean;
}

export function OmniCommandBar({
  onCommand,
  isVoiceActive,
  onToggleVoice,
  onScanCamera,
  onScanScreen,
  onTriggerDance,
  onToggleSpatialMode,
  spatialMode,
  visionScanning,
}: OmniCommandBarProps) {
  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const addWidget = useWidgetStore((state) => state.addWidget);
  const activeWidgets = useWidgetStore((state) => state.widgets);

  const availableApps: Array<{
    type: WidgetType;
    title: string;
    icon: string;
    w: number;
    h: number;
    iconNode: React.ReactNode;
  }> = [
    { type: 'chronos', title: 'Chronos Clock', icon: 'Clock', w: 280, h: 180, iconNode: <Clock className="w-4 h-4" /> },
    { type: 'telemetry', title: 'Hardware Telemetry', icon: 'Activity', w: 290, h: 260, iconNode: <Activity className="w-4 h-4" /> },
    { type: 'neural-log', title: 'Neural AI Log', icon: 'Cpu', w: 440, h: 460, iconNode: <Cpu className="w-4 h-4" /> },
    { type: 'scratchpad', title: 'Scratchpad Notes', icon: 'Edit3', w: 340, h: 320, iconNode: <Edit3 className="w-4 h-4" /> },
    { type: 'video-player', title: 'Cyber Video Player', icon: 'Video', w: 440, h: 320, iconNode: <Video className="w-4 h-4" /> },
    { type: 'rps-game', title: 'RPS Gesture Game', icon: 'Gamepad2', w: 360, h: 340, iconNode: <Gamepad2 className="w-4 h-4" /> },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onCommand(input.trim());
      setInput('');
    }
  };

  const spawnWidget = (app: typeof availableApps[0]) => {
    const offset = (activeWidgets.length * 30) % 90 - 45;
    addWidget({
      id: `w_${app.type}`,
      type: app.type,
      title: app.title,
      icon: app.icon,
      x: Math.max(20, Math.floor(window.innerWidth / 2 - app.w / 2 + offset)),
      y: Math.max(60, Math.floor(window.innerHeight / 2 - app.h / 2 + offset)),
      width: app.w,
      height: app.h,
    });
    setDrawerOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-3xl z-40 px-4 flex flex-col items-center select-none pointer-events-auto">
      {/* App Drawer Popover */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="mb-3 glass-panel p-3.5 rounded-2xl w-full max-w-xl flex gap-3 overflow-x-auto shadow-[0_10px_35px_rgba(0,0,0,0.8)] border border-cyan-500/30"
          >
            {availableApps.map((app) => {
              const isOpen = activeWidgets.some((w) => w.type === app.type);
              return (
                <button
                  key={app.type}
                  type="button"
                  onClick={() => spawnWidget(app)}
                  className={`flex flex-col items-center gap-2 p-2.5 rounded-xl transition-all flex-shrink-0 min-w-[76px] ${
                    isOpen 
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-200' 
                      : 'bg-black/30 border border-white/5 hover:bg-cyan-950/40 hover:border-cyan-500/30 text-gray-400 hover:text-cyan-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    {app.iconNode}
                  </div>
                  <span className="text-[9px] font-bold font-mono tracking-wider uppercase text-center leading-tight">
                    {app.title.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bar Panel */}
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", damping: 22 }}
        className="w-full glass-panel p-2 pl-2.5 flex flex-col gap-2 rounded-2xl border border-cyan-500/30 shadow-[0_0_40px_rgba(0,240,255,0.15)]"
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2.5 w-full">
          {/* App Drawer Toggle Button */}
          <button 
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            title="Aura OS App Drawer"
            className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${
              drawerOpen 
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.8)]' 
                : 'bg-cyan-950/40 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300'
            }`}
          >
            <Plus className={`w-4 h-4 transition-transform ${drawerOpen ? 'rotate-45' : ''}`} />
          </button>

          {/* Voice Assistant Toggle */}
          <button
            type="button"
            onClick={onToggleVoice}
            title={isVoiceActive ? "Mute Voice Link" : "Activate Voice Link"}
            className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${
              isVoiceActive
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse'
                : 'bg-cyan-950/40 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300'
            }`}
          >
            {isVoiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Sparkles Prompt Icon */}
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse ml-0.5 flex-shrink-0" />

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Command Ashura OS (e.g. 'play synthwave', 'scan camera', 'specs', 'dance')..."
            className="w-full bg-transparent border-none outline-none text-white placeholder-cyan-500/40 text-xs font-mono tracking-wide py-1.5"
          />

          {/* Action Dock Buttons (Camera, Screen, Dance, Spatial Mode) */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Scan Camera */}
            <button
              type="button"
              onClick={onScanCamera}
              disabled={visionScanning}
              title="Multimodal Webcam Scan"
              className="px-2 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold font-mono flex items-center gap-1 transition-colors"
            >
              <Eye className="w-3 h-3 text-pink-400" />
              <span className="hidden sm:inline">CAM</span>
            </button>

            {/* Scan Screen */}
            <button
              type="button"
              onClick={onScanScreen}
              disabled={visionScanning}
              title="Desktop Screen Vision Scan"
              className="px-2 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold font-mono flex items-center gap-1 transition-colors"
            >
              <Monitor className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">SCREEN</span>
            </button>

            {/* Dance */}
            <button
              type="button"
              onClick={onTriggerDance}
              title="Trigger Chibi Avatar Dance"
              className="px-2 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold font-mono flex items-center gap-1 transition-colors"
            >
              <Music className="w-3 h-3 text-yellow-400" />
              <span className="hidden sm:inline">DANCE</span>
            </button>

            {/* Spatial Desktop Mode Toggle */}
            <button
              type="button"
              onClick={onToggleSpatialMode}
              title={spatialMode ? "Focus 3D Avatar (Hide Windows)" : "Show Spatial Workspace"}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold font-mono flex items-center gap-1 transition-colors ${
                spatialMode 
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.3)]' 
                  : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400/80 hover:bg-cyan-500/20'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden md:inline">{spatialMode ? 'SPATIAL' : 'AVATAR'}</span>
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-cyan-500 text-black font-bold font-mono text-[10px] hover:bg-cyan-400 transition-colors tracking-wider"
            >
              ↵
            </button>
          </div>
        </form>

        {/* Suggestion Chips Row */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 pt-0.5 scrollbar-none">
          {[
            { label: "LOFI BEATS ☕", cmd: "play lofi beats" },
            { label: "SYNTHWAVE 🌆", cmd: "play synthwave" },
            { label: "DANCE 💃", cmd: "dance for me" },
            { label: "RPS GAME ✊", cmd: "play rock paper scissors" },
            { label: "5M TIMER ⏱️", cmd: "set a 5 minute timer" },
            { label: "TAKE NOTE 📝", cmd: "add note review project progress" },
            { label: "SPACEX NEWS 🚀", cmd: "what is happening with SpaceX today?" },
            { label: "SPECS 💻", cmd: "what are my system specs?" },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onCommand(chip.cmd)}
              className="px-2 py-0.5 rounded bg-cyan-950/50 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-400/50 text-[9px] font-mono font-semibold text-cyan-300/80 hover:text-cyan-200 transition-colors whitespace-nowrap flex-shrink-0"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
