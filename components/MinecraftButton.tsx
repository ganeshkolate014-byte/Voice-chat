import React from 'react';

interface MinecraftButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger' | 'success';
  fullWidth?: boolean;
}

export const MinecraftButton: React.FC<MinecraftButtonProps> = ({ 
  children, 
  variant = 'default', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "relative h-12 font-['VT323'] text-2xl uppercase tracking-wider text-white border-2 select-none active:translate-y-[2px] transition-transform flex items-center justify-center";
  
  const variants = {
    default: "bg-[#7c7c7c] border-t-[#dbdbdb] border-l-[#dbdbdb] border-b-[#2b2b2b] border-r-[#2b2b2b] hover:bg-[#8d8d8d] active:border-t-[#2b2b2b] active:border-l-[#2b2b2b] active:border-b-[#dbdbdb] active:border-r-[#dbdbdb]",
    danger: "bg-[#a12e2e] border-t-[#ff6b6b] border-l-[#ff6b6b] border-b-[#4a1515] border-r-[#4a1515] hover:bg-[#b53a3a] active:border-t-[#4a1515] active:border-l-[#4a1515] active:border-b-[#ff6b6b] active:border-r-[#ff6b6b]",
    success: "bg-[#33691e] border-t-[#76d275] border-l-[#76d275] border-b-[#1b5e20] border-r-[#1b5e20] hover:bg-[#558b2f] active:border-t-[#1b5e20] active:border-l-[#1b5e20] active:border-b-[#76d275] active:border-r-[#76d275]",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : 'px-8'} ${className}`}
      style={{ textShadow: '2px 2px 0px #3f3f3f' }}
      {...props}
    >
      {children}
    </button>
  );
};
