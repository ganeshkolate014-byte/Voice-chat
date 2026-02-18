import React, { useEffect, useRef } from 'react';

interface StreamAudioProps {
  stream: MediaStream;
  muted?: boolean;
}

export const StreamAudio: React.FC<StreamAudioProps> = ({ stream, muted = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      // Ensure audio plays even if the browser policy tries to block it
      audioRef.current.play().catch(e => console.error("Autoplay failed", e));
    }
  }, [stream]);

  return (
    <audio 
      ref={audioRef} 
      autoPlay 
      playsInline 
      controls={false} 
      className="hidden" 
      muted={muted}
    />
  );
};