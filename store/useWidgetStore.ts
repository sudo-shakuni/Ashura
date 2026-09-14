import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetType = 
  | 'chronos' 
  | 'telemetry' 
  | 'neural-log' 
  | 'scratchpad' 
  | 'video-player' 
  | 'rps-game' 
  | 'vision-scanner';

export interface WidgetState {
  id: string;
  type: WidgetType;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized?: boolean;
}

interface AppState {
  widgets: WidgetState[];
  activeWidgetId: string | null;
  spatialMode: boolean;
  particleCanvasEnabled: boolean;
  setSpatialMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  toggleParticleCanvas: () => void;
  bringToFront: (id: string) => void;
  updateWidgetPosition: (id: string, x: number, y: number) => void;
  updateWidgetSize: (id: string, width: number, height: number) => void;
  toggleMinimize: (id: string) => void;
  addWidget: (widget: Omit<WidgetState, 'zIndex'>) => void;
  removeWidget: (id: string) => void;
  resetLayout: () => void;
}

// Initial default widgets for the workspace, arranged neatly around the center 3D avatar
const initialWidgets: WidgetState[] = [
  { id: 'w_chronos', type: 'chronos', title: 'Chronos', icon: 'Clock', x: 40, y: 70, width: 280, height: 180, zIndex: 10 },
  { id: 'w_telemetry', type: 'telemetry', title: 'Telemetry', icon: 'Activity', x: 40, y: 270, width: 290, height: 260, zIndex: 11 },
  { id: 'w_neural', type: 'neural-log', title: 'Neural Log', icon: 'Cpu', x: 350, y: 70, width: 440, height: 460, zIndex: 12 },
  { id: 'w_scratchpad', type: 'scratchpad', title: 'Scratchpad', icon: 'Edit3', x: 810, y: 70, width: 340, height: 320, zIndex: 13 },
];

export const useWidgetStore = create<AppState>()(
  persist(
    (set) => ({
      widgets: initialWidgets,
      activeWidgetId: null,
      spatialMode: true,
      particleCanvasEnabled: true,

      setSpatialMode: (mode) => set((state) => ({
        spatialMode: typeof mode === 'function' ? mode(state.spatialMode) : mode,
      })),

      toggleParticleCanvas: () => set((state) => ({
        particleCanvasEnabled: !state.particleCanvasEnabled,
      })),

      bringToFront: (id) => set((state) => {
        const maxZ = Math.max(...state.widgets.map((w) => w.zIndex), 10);
        return {
          activeWidgetId: id,
          widgets: state.widgets.map((w) => 
            w.id === id ? { ...w, zIndex: maxZ + 1 } : w
          ),
        };
      }),

      updateWidgetPosition: (id, x, y) => set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === id ? { ...w, x, y } : w
        ),
      })),

      updateWidgetSize: (id, width, height) => set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === id ? { ...w, width, height } : w
        ),
      })),

      toggleMinimize: (id) => set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === id ? { ...w, minimized: !w.minimized } : w
        ),
      })),

      addWidget: (widget) => set((state) => {
        const existing = state.widgets.find((w) => w.type === widget.type);
        if (existing) {
          // If already exists, bring it to front and un-minimize
          const maxZ = Math.max(...state.widgets.map((w) => w.zIndex), 10);
          return {
            activeWidgetId: existing.id,
            widgets: state.widgets.map((w) =>
              w.id === existing.id ? { ...w, zIndex: maxZ + 1, minimized: false } : w
            ),
          };
        }
        const maxZ = Math.max(...state.widgets.map((w) => w.zIndex), 10);
        return {
          widgets: [...state.widgets, { ...widget, zIndex: maxZ + 1 }],
          activeWidgetId: widget.id,
        };
      }),

      removeWidget: (id) => set((state) => ({
        widgets: state.widgets.filter((w) => w.id !== id),
      })),

      resetLayout: () => set({
        widgets: initialWidgets,
      }),
    }),
    {
      name: 'ashura-aura-os-storage',
    }
  )
);
