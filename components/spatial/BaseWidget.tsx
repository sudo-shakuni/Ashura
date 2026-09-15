'use client';

import React from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useWidgetStore } from '@/store/useWidgetStore';
import { 
  Clock, 
  Activity, 
  Cpu, 
  Edit3, 
  Video, 
  Gamepad2, 
  Eye, 
  Minus, 
  X, 
  Maximize2 
} from 'lucide-react';

interface BaseWidgetProps {
  id: string;
  title: string;
  iconName: string;
  children: React.ReactNode;
}

export function BaseWidget({ id, title, iconName, children }: BaseWidgetProps) {
  const widget = useWidgetStore((state) => state.widgets.find((w) => w.id === id));
  const bringToFront = useWidgetStore((state) => state.bringToFront);
  const updateWidgetPosition = useWidgetStore((state) => state.updateWidgetPosition);
  const toggleMinimize = useWidgetStore((state) => state.toggleMinimize);
  const removeWidget = useWidgetStore((state) => state.removeWidget);
  
  const dragControls = useDragControls();
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

  if (!widget) return null;

  const renderIcon = (name: string) => {
    const n = name.toLowerCase();
    const props = { className: "w-4 h-4 text-cyan-400" };
    if (n.includes('clock')) return <Clock {...props} />;
    if (n.includes('activity') || n.includes('telemetry')) return <Activity {...props} />;
    if (n.includes('cpu') || n.includes('neural')) return <Cpu {...props} />;
    if (n.includes('edit') || n.includes('pen') || n.includes('scratchpad')) return <Edit3 {...props} />;
    if (n.includes('video') || n.includes('youtube')) return <Video {...props} />;
    if (n.includes('game') || n.includes('rps')) return <Gamepad2 {...props} />;
    if (n.includes('eye') || n.includes('vision')) return <Eye {...props} />;
    return <Cpu {...props} />;
  };

  const isMinimized = !!widget.minimized;

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false} // Drag only from header
      dragMomentum={false}
      initial={{ x: widget.x, y: widget.y, opacity: 0, scale: 0.95 }}
      animate={{ 
        x: widget.x, 
        y: widget.y, 
        opacity: 1, 
        scale: 1,
        height: isMinimized ? 44 : widget.height 
      }}
      transition={{ type: "tween", duration: 0.14, ease: "easeOut" }}
      onDragEnd={(_, info) => {
        const nextX = clamp(Math.round(widget.x + info.offset.x), 8, window.innerWidth - widget.width - 8);
        const currentHeight = isMinimized ? 44 : widget.height;
        const nextY = clamp(Math.round(widget.y + info.offset.y), 8, window.innerHeight - currentHeight - 8);
        updateWidgetPosition(id, nextX, nextY);
      }}
      onPointerDown={() => bringToFront(id)}
      style={{ 
        width: widget.width, 
        zIndex: widget.zIndex,
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
      }}
      className="glass-panel flex flex-col shadow-2xl overflow-hidden select-none"
    >
      {/* Sci-fi Chamfer corner brackets */}
      <div className="corner-bracket corner-tl" style={{ borderColor: 'rgba(0, 240, 255, 0.4)' }} />
      <div className="corner-bracket corner-tr" style={{ borderColor: 'rgba(0, 240, 255, 0.4)' }} />
      <div className="corner-bracket corner-bl" style={{ borderColor: 'rgba(0, 240, 255, 0.4)' }} />
      <div className="corner-bracket corner-br" style={{ borderColor: 'rgba(0, 240, 255, 0.4)' }} />

      {/* Draggable Header */}
      <div 
        onPointerDown={(e) => {
          bringToFront(id);
          dragControls.start(e);
        }}
        className="px-3.5 py-2.5 border-b border-cyan-500/20 flex items-center gap-2.5 cursor-grab active:cursor-grabbing bg-cyan-950/20 hover:bg-cyan-900/30 transition-colors"
        style={{
          background: 'linear-gradient(90deg, rgba(0, 240, 255, 0.08) 0%, rgba(3, 10, 24, 0.4) 100%)',
        }}
      >
        <div className="flex items-center justify-center p-1 rounded bg-cyan-500/10 border border-cyan-500/30">
          {renderIcon(iconName || widget.icon || widget.title)}
        </div>
        
        <span 
          className="text-xs font-bold tracking-wider uppercase text-cyan-300 font-mono"
          style={{ textShadow: '0 0 8px rgba(0, 240, 255, 0.4)' }}
        >
          {title}
        </span>

        <div className="ml-auto flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {/* Minimize / Expand button */}
          <button
            type="button"
            title={isMinimized ? "Expand" : "Minimize"}
            onClick={() => toggleMinimize(id)}
            className="w-5 h-5 rounded flex items-center justify-center bg-cyan-950/40 border border-cyan-500/30 hover:border-yellow-400/80 hover:bg-yellow-500/20 text-cyan-300 hover:text-yellow-300 transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
          </button>
          
          {/* Close button */}
          <button
            type="button"
            title="Close"
            onClick={() => removeWidget(id)}
            className="w-5 h-5 rounded flex items-center justify-center bg-cyan-950/40 border border-cyan-500/30 hover:border-red-500/80 hover:bg-red-500/20 text-cyan-300 hover:text-red-400 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      
      {/* Content Area (collapses when minimized) */}
      {!isMinimized && (
        <div 
          className="flex-1 p-3.5 overflow-y-auto cursor-auto text-cyan-100" 
          onPointerDown={(e) => e.stopPropagation()}
          style={{ maxHeight: widget.height - 44 }}
        >
          {children}
        </div>
      )}
    </motion.div>
  );
}
