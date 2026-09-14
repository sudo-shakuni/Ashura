'use client';

import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface ScratchpadWidgetProps {
  notes: Array<{ id: string; text: string; timestamp: string }>;
  onAddNote: (text: string) => void;
  onDeleteNote: (id: string) => void;
}

export function ScratchpadWidget({ notes, onAddNote, onDeleteNote }: ScratchpadWidgetProps) {
  const [inputText, setInputText] = useState('');

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    onAddNote(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full gap-2.5 font-mono text-xs">
      {/* Input row */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="New note or directive..."
          className="flex-1 bg-black/40 border border-cyan-500/30 rounded px-2.5 py-1.5 text-white placeholder-cyan-500/40 text-xs focus:outline-none focus:border-cyan-400 font-sans"
        />
        <button
          type="submit"
          className="px-2.5 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/40 font-bold flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          ADD
        </button>
      </form>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-cyan-500/50 text-[11px] italic gap-1">
            <span>No notes stored.</span>
            <span className="text-[10px]">Say &ldquo;Ashura, add note...&rdquo; or type above.</span>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-2.5 rounded bg-cyan-950/30 border border-cyan-500/20 flex justify-between items-start gap-2 hover:border-cyan-500/40 transition-colors group"
            >
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400/70">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                  <span>{note.timestamp}</span>
                </div>
                <div className="text-cyan-100 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                  {note.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDeleteNote(note.id)}
                className="opacity-40 group-hover:opacity-100 text-cyan-400 hover:text-red-400 transition-opacity p-1"
                title="Delete note"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
