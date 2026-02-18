import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glow';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  // Neo-Brutalist Base Styles
  const baseStyles = "relative h-12 px-6 font-bold text-lg border-[3px] border-black rounded-xl transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none";
  
  const variants = {
    // Violet Pastel
    primary: "bg-[#C4B5FD] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#A78BFA]", 
    // White
    secondary: "bg-white text-black shadow-[4px_4px_0px_0px_#000] hover:bg-gray-50",
    // Soft Red
    danger: "bg-[#FCA5A5] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#F87171]",
    // Transparent (No border for ghost in this style usually, or dashed)
    ghost: "bg-transparent border-transparent shadow-none hover:bg-black/5 !border-0",
    // Bright Yellow
    glow: "bg-[#FDE047] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FACC15]" 
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};