import React, { useState } from 'react';
import { Item } from '@/lib/types';

interface ActionPanelProps {
  options: string[];
  onAction: (actionText: string, usedItem?: Item) => void;
  disabled: boolean;
  inventory?: Item[];
  onOpenInventory?: () => void;
}

export function ActionPanel({ options = [], onAction, disabled, inventory = [], onOpenInventory }: ActionPanelProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onAction(text.trim());
      setText('');
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-end gap-2 bg-black/60 p-3 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl pointer-events-auto overflow-y-auto">
      <div className="flex justify-between items-end shrink-0">
        <h3 className="text-sm text-gray-400 font-bold tracking-widest uppercase">Select Action</h3>
        <button
          onClick={onOpenInventory}
          disabled={disabled || inventory.length === 0}
          className="text-xs font-bold tracking-widest bg-yellow-900/50 hover:bg-yellow-700 text-yellow-200 border border-yellow-600/50 py-1 px-3 rounded-full transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>💼</span> INVENTORY ({inventory.length})
        </button>
      </div>
      
      <div className="flex flex-col gap-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500">
        {options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => onAction(opt)}
            disabled={disabled}
            className="w-full text-left bg-black/70 hover:bg-gray-800 text-white py-2 px-3 rounded-xl text-sm transition-all border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:border-gray-400 whitespace-normal break-words shrink-0"
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="mt-1 pt-2 border-t border-white/20 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            placeholder="自由記述で発言・行動する..."
            className="flex-1 bg-white/90 text-black px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner min-w-0"
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-md shrink-0"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  );
}
