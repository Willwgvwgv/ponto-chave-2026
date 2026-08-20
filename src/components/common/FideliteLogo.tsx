import React from 'react';

interface FideliteLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FideliteLogo: React.FC<FideliteLogoProps> = ({ className = "", size = 'md' }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const titleSize = isSm ? "text-xl" : isLg ? "text-3xl" : "text-2xl";
  const subSize = isSm ? "text-[9px]" : isLg ? "text-[12px]" : "text-[10px]";
  const barWidth = isSm ? "w-3 h-0.5" : isLg ? "w-5 h-1" : "w-4 h-0.5";
  const barTop = isSm ? "-top-1" : isLg ? "-top-2" : "-top-1.5";

  return (
    <div className={`flex flex-col select-none leading-none ${className}`}>
      <div className="flex items-baseline">
        <span className={`${titleSize} font-black tracking-tight text-[#002D62] font-sans flex items-center`}>
          Fid
          <span className="relative inline-block mx-[0.5px]">
            <span className={`absolute ${barTop} left-1/2 -translate-x-1/2 ${barWidth} bg-[#E52E2D] rounded-full`}></span>
            ē
          </span>
          litē
        </span>
      </div>
      <span className={`${subSize} font-bold text-[#E52E2D] tracking-widest lowercase mt-0.5 font-sans`}>
        negócios imobiliários
      </span>
    </div>
  );
};
