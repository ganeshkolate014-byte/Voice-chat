import React from 'react';

interface VolumeVisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
  bars?: number;
}

export const VolumeVisualizer: React.FC<VolumeVisualizerProps> = ({ volume, isActive, bars = 5 }) => {
  // Create an array for bars
  const barsArray = Array.from({ length: bars });

  return (
    <div className="flex items-end justify-center gap-[3px] h-6">
      {barsArray.map((_, i) => {
        // Calculate a simulated height based on volume and index to create a wave effect
        // Center bars are taller
        let barHeight = 0;
        if (isActive && volume > 0.01) {
            // Simple logic to vary bar height based on single volume value
            // Randomize slightly to look like frequency data
            const randomOffset = Math.random() * 0.3;
            const centerMultiplier = 1 - Math.abs(i - (bars - 1) / 2) * 0.2;
            barHeight = Math.max(10, Math.min(100, volume * 100 * 2 * centerMultiplier + (randomOffset * 100)));
        } else {
            barHeight = 10; // min height
        }

        return (
            <div 
                key={i}
                className={`w-1.5 rounded-full transition-all duration-75 ${isActive && volume > 0.01 ? 'bg-gradient-to-t from-violet-500 to-fuchsia-400' : 'bg-slate-700'}`}
                style={{ height: `${barHeight}%` }}
            />
        );
      })}
    </div>
  );
};