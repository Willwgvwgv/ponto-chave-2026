import React from 'react';

interface FideliteLogoProps {
  className?: string;
  height?: number | string;
}

export const FideliteLogo: React.FC<FideliteLogoProps> = ({ className = "h-14", height }) => {
  return (
    <div className={`flex flex-col select-none ${className}`} style={height ? { height } : undefined}>
      <div className="flex items-baseline">
        <span className="text-3xl font-extrabold tracking-tight text-[#002D62] font-sans flex items-center">
          Fid
          <span className="relative inline-block">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#E52E2D] rounded-full"></span>
            ē
          </span>
          litē
        </span>
      </div>
      <span className="text-[12px] font-semibold text-[#E52E2D] tracking-widest lowercase -mt-1 font-sans">
        negócios imobiliários
      </span>
    </div>
  );
};
