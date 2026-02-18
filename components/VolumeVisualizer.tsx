import React from 'react';

interface VolumeVisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
}

export const VolumeVisualizer: React.FC<VolumeVisualizerProps> = ({ volume, isActive }) => {
  // Create 10 segments for the XP bar look
  const segments = Array.from({ length: 18 });
  
  // Volume is 0-1. We map it to active segments.
  const activeSegments = Math.min(Math.ceil(volume * 18), 18);

  return (
    <div className="w-full max-w-md mx-auto mt-4 p-1">
      <div className="relative h-4 bg-[#3a3a3a] border-2 border-[#1a1a1a] flex items-center px-1">
         {/* XP Bar Background Texture approximation */}
         <div className="absolute inset-0 bg-[#2b2b2b] opacity-50"></div>
         
         {/* Segments */}
         <div className="relative flex w-full h-2 gap-[2px]">
           {segments.map((_, i) => (
             <div
               key={i}
               className={`flex-1 transition-colors duration-75 ${
                 isActive && i < activeSegments 
                   ? 'bg-[#80ff20] border-t-2 border-t-[#b2ff59] border-b-2 border-b-[#33691e]' 
                   : 'bg-[#1a1a1a]'
               }`}
             ></div>
           ))}
         </div>
      </div>
      <div className="text-center font-['VT323'] text-[#80ff20] text-lg mt-1" style={{ textShadow: '1px 1px 0 #000' }}>
         {isActive ? (volume > 0.05 ? 'Listening...' : 'Mic Active') : 'Mic Off'}
      </div>
    </div>
  );
};
