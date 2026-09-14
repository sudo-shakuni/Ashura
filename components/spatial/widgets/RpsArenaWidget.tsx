'use client';

import React from 'react';
import { Gamepad2, Trophy, RotateCcw } from 'lucide-react';

export type HandMove = 'rock' | 'paper' | 'scissors' | 'unknown';

interface RpsArenaWidgetProps {
  playerMove: HandMove;
  agentMove: HandMove | null;
  countdown: number;
  result: string | null;
  isPlaying: boolean;
  onStartGame: () => void;
}

export function RpsArenaWidget({
  playerMove,
  agentMove,
  countdown,
  result,
  isPlaying,
  onStartGame,
}: RpsArenaWidgetProps) {
  const getMoveEmoji = (m: HandMove | null) => {
    switch (m) {
      case 'rock': return '✊ ROCK';
      case 'paper': return '🖐️ PAPER';
      case 'scissors': return '✌️ SCISSORS';
      default: return '❓ WAITING';
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 font-mono text-xs items-center justify-center text-center">
      {/* Game Header */}
      <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase tracking-wider text-xs">
        <Gamepad2 className="w-4 h-4 text-pink-400" />
        MEDIA PIPE HAND GESTURE ARENA
      </div>

      {/* Arena Stage */}
      <div className="w-full grid grid-cols-2 gap-3 p-3 rounded-lg bg-black/40 border border-cyan-500/30">
        {/* Ashura Move */}
        <div className="flex flex-col items-center gap-1 p-2 rounded bg-cyan-950/40 border border-cyan-500/20">
          <span className="text-[10px] text-cyan-400/80 font-bold">🤖 ASHURA</span>
          <div className="text-xl font-bold text-cyan-200 my-1">
            {countdown > 0 ? '🎲 ...' : getMoveEmoji(agentMove)}
          </div>
        </div>

        {/* Player Move */}
        <div className="flex flex-col items-center gap-1 p-2 rounded bg-cyan-950/40 border border-cyan-500/20">
          <span className="text-[10px] text-indigo-400/80 font-bold">👤 YOU (CAM)</span>
          <div className="text-xl font-bold text-indigo-200 my-1">
            {getMoveEmoji(playerMove)}
          </div>
        </div>
      </div>

      {/* Countdown or Outcome */}
      {countdown > 0 ? (
        <div className="flex flex-col items-center gap-1 animate-bounce">
          <span className="text-3xl font-extrabold text-yellow-400 font-mono">
            {countdown}
          </span>
          <span className="text-[11px] text-yellow-300 tracking-wider">
            HOLD UP YOUR HAND GESTURE!
          </span>
        </div>
      ) : result ? (
        <div className="flex flex-col items-center gap-1 p-2 rounded bg-cyan-950/60 border border-cyan-400/40 w-full">
          <span className="flex items-center gap-1 text-sm font-extrabold text-white">
            <Trophy className="w-4 h-4 text-yellow-400" />
            {result}
          </span>
        </div>
      ) : (
        <div className="text-[11px] text-cyan-400/60">
          Position your hand in front of the camera and tap Start!
        </div>
      )}

      {/* Action Button */}
      <button
        type="button"
        onClick={onStartGame}
        disabled={isPlaying}
        className={`w-full py-2 rounded font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all ${
          isPlaying
            ? 'bg-cyan-950/40 border border-cyan-500/20 text-cyan-500/50 cursor-not-allowed'
            : 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 hover:bg-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
        }`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {isPlaying ? 'ROUND IN PROGRESS...' : 'START ROUND (3 SEC COUNTDOWN)'}
      </button>
    </div>
  );
}
