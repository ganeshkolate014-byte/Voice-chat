import React from 'react';

interface VolumeVisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
  bars?: number;
}

export const VolumeVisualizer: React.FC<VolumeVisualizerProps> = ({ volume, isActive, bars = 5 }) => {
  const barsArray = Array.from({ length: bars });

  return (
    <div className="flex items-end justify-center gap-[4px] h-8">
      {barsArray.map((_, i) => {
        let barHeight = 15; // default 15%
        if (isActive && volume > 0.01) {
            const randomOffset = Math.random() * 0.3;
            const centerMultiplier = 1 - Math.abs(i - (bars - 1) / 2) * 0.2;
            barHeight = Math.max(15, Math.min(100, volume * 100 * 2.5 * centerMultiplier + (randomOffset * 50)));
        }

        return (
            <div 
                key={i}
                className={`w-2.5 rounded-sm border-2 border-black transition-all duration-75 ${isActive && volume > 0.01 ? 'bg-[#F472B6]' : 'bg-white'}`}
                style={{ height: `${barHeight}%` }}
            />
        );
      })}
    </div>
  );
};