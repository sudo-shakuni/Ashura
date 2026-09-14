'use client';

import React, { useRef, useEffect } from 'react';
import { Sparkles, Terminal, Globe, Activity, Eye, Trash2 } from 'lucide-react';

export interface NeuralMessage {
  id: string;
  sender: 'USER' | 'ASHURA' | 'SYSTEM' | 'TOOL';
  text: string;
  timestamp: string;
  tools?: string[];
}

interface NeuralLogWidgetProps {
  messages: NeuralMessage[];
  onClear?: () => void;
  statusText?: string;
}

export function NeuralLogWidget({ messages, onClear, statusText }: NeuralLogWidgetProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  const renderToolIcon = (tool: string) => {
    const t = tool.toLowerCase();
    if (t.includes('web') || t.includes('search')) return <Globe className="w-3 h-3 text-cyan-400" />;
    if (t.includes('system') || t.includes('cmd')) return <Terminal className="w-3 h-3 text-emerald-400" />;
    if (t.includes('vision') || t.includes('scan')) return <Eye className="w-3 h-3 text-pink-400" />;
    return <Activity className="w-3 h-3 text-amber-400" />;
  };

  return (
    <div className="flex flex-col h-full gap-3 font-mono text-xs">
      {/* Header bar with clear button */}
      <div className="flex justify-between items-center pb-2 border-b border-cyan-500/20">
        <span className="text-[10px] text-cyan-400/80 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          NEURAL CONVERSATION STREAM ({messages.length})
        </span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded text-cyan-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Clear Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-cyan-500/50 text-[11px] italic">
            Awaiting voice or command input...
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'USER';
            const isSystem = msg.sender === 'SYSTEM' || msg.sender === 'TOOL';

            return (
              <div
                key={msg.id}
                className={`p-2.5 rounded-lg border leading-relaxed transition-all ${
                  isUser
                    ? 'bg-indigo-500/10 border-indigo-500/30 ml-6 text-indigo-100'
                    : isSystem
                    ? 'bg-amber-500/10 border-amber-500/30 mx-2 text-amber-200'
                    : 'bg-cyan-950/40 border-cyan-500/25 mr-6 text-cyan-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`font-bold text-[10px] tracking-wider uppercase flex items-center gap-1 ${
                      isUser
                        ? 'text-indigo-400'
                        : isSystem
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                    }`}
                  >
                    {isUser ? '👤 USER' : isSystem ? '⚡ SYSTEM' : '🤖 ASHURA'}
                  </span>
                  <span className="text-[9px] text-gray-500">{msg.timestamp}</span>
                </div>

                {/* Tool Badges if any */}
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap my-1.5">
                    {msg.tools.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold uppercase"
                      >
                        {renderToolIcon(t)}
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-xs break-words whitespace-pre-wrap font-sans font-light">
                  {msg.text}
                </div>
              </div>
            );
          })
        )}

        {/* Live Thought / Transcription Status */}
        {statusText && (
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 text-xs italic animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            {statusText}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
