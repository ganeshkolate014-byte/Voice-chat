import React, { useEffect, useRef } from 'react';

interface StreamVideoProps {
  stream: MediaStream;
}

export const StreamVideo: React.FC<StreamVideoProps> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-contain bg-black rounded-lg"
    />
  );
};
