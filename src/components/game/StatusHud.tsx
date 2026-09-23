import React from 'react';
import { GameState } from '@/lib/types';

interface StatusHudProps {
  state: GameState;
}

export function StatusHud({ state }: StatusHudProps) {
  const characters = Object.values(state.characters);

  return (
    <div className="w-full shrink-0 bg-black/80 rounded-2xl p-3 text-white font-sans backdrop-blur-md shadow-2xl border border-white/10 pointer-events-auto">
      <div className="flex justify-between items-end mb-1 border-b border-white/20 pb-1">
        <h2 className="text-sm font-bold text-gray-200 tracking-widest uppercase">Trust Level</h2>
        <div className="text-right leading-none flex items-end gap-3">
          <div>
            <span className="text-[10px] text-gray-400">LVL </span>
            <span className="font-bold text-base text-yellow-400 ml-1">{state.playerLevel}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400">DAY </span>
            <span className="font-bold text-base text-purple-400 ml-1">{state.day}</span>
            <span className="text-[10px] text-gray-400 ml-2">STEP </span>
            <span className="font-bold text-base text-purple-400 ml-1">{state.step}</span>
            <span className="text-[10px] text-gray-400 ml-1">/ 5</span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-1">
        {characters.map((char) => {
          let barColor = "bg-green-500";
          if (char.trust < 30) barColor = "bg-red-500";
          else if (char.trust < 60) barColor = "bg-orange-500";
          
          return (
            <div key={char.id} className="flex flex-col">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-xs font-medium tracking-wide leading-none">{char.name}</span>
                <span className="text-xs text-gray-300 font-mono leading-none">{char.trust}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden shadow-inner">
                <div
                  className={`${barColor} h-1.5 rounded-full transition-all duration-700 ease-out`}
                  style={{ width: `${Math.min(100, Math.max(0, char.trust))}%` }}
                ></div>
              </div>
            </div>
          );
        })}
        
        {/* 会社貢献度 */}
        <div className="flex flex-col mt-1 pt-1 border-t border-white/20">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-xs font-bold tracking-wide text-yellow-400 leading-none">COMPANY CONTRIBUTION</span>
            <span className="text-xs text-yellow-300 font-mono leading-none">{state.companyContribution}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden shadow-inner">
            <div
              className={`bg-yellow-500 h-1.5 rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, state.companyContribution))}%` }}
            ></div>
          </div>
        </div>

        {/* EXP */}
        <div className="flex flex-col mt-1">
          <div className="w-full bg-gray-800 rounded-full h-[3px] overflow-hidden shadow-inner relative">
            <div
              className={`bg-blue-500 h-[3px] rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, state.playerExp))}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
