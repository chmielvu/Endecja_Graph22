
import React from 'react';
import { useStore } from '../store';

export const Timeline: React.FC = () => {
  const { timelineYear, setFilterYear } = useStore();
  
  // Continuous range 1850 - 1950
  const MIN_YEAR = 1850;
  const MAX_YEAR = 1950;

  return (
    <div className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center px-6 gap-6 shrink-0 relative z-20">
      <button 
        onClick={() => setFilterYear(null)}
        className={`text-xs font-mono px-3 py-1 rounded transition-colors whitespace-nowrap border ${timelineYear === null ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'}`}
      >
        ALL TIME
      </button>
      
      <div className="w-[1px] h-8 bg-zinc-800 mx-2"></div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-2 uppercase">
           <span>{MIN_YEAR}</span>
           {timelineYear && <span className="text-indigo-400 font-bold text-sm">{timelineYear}</span>}
           <span>{MAX_YEAR}</span>
        </div>
        
        <input 
          type="range"
          min={MIN_YEAR}
          max={MAX_YEAR}
          step={1}
          value={timelineYear || 1900}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
        />
        
        {/* Ticks */}
        <div className="w-full flex justify-between mt-1 px-1">
          {Array.from({ length: 11 }).map((_, i) => (
             <div key={i} className="w-[1px] h-1 bg-zinc-700"></div>
          ))}
        </div>
      </div>
    </div>
  );
};
