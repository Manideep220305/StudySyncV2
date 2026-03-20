import React from 'react';

export const CircuitBoard = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-slate-950">
      
      {/* 1. The Static Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #808080 1px, transparent 1px),
            linear-gradient(to bottom, #808080 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)' // Fades out at edges
        }}
      ></div>

      {/* 2. Horizontal Beam (Shoots Left to Right) */}
      <div className="absolute top-[30%] left-0 h-[1px] w-full animate-grid-beam-h opacity-0">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent blur-[1px]"></div>
      </div>
      
      {/* 3. Horizontal Beam (Shoots Left to Right - Lower) */}
      <div className="absolute top-[70%] left-0 h-[1px] w-full animate-grid-beam-h opacity-0" style={{ animationDelay: '4s' }}>
        <div className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent blur-[1px]"></div>
      </div>

      {/* 4. Vertical Beam (Shoots Top to Bottom) */}
      <div className="absolute left-[20%] top-0 w-[1px] h-full animate-grid-beam-v opacity-0">
         <div className="w-full h-full bg-gradient-to-b from-transparent via-cyan-500 to-transparent blur-[1px]"></div>
      </div>

      {/* 5. Vertical Beam (Shoots Top to Bottom - Right Side) */}
      <div className="absolute right-[20%] top-0 w-[1px] h-full animate-grid-beam-v opacity-0" style={{ animationDelay: '5s' }}>
         <div className="w-full h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent blur-[1px]"></div>
      </div>

      {/* 6. Subtle Glow at the Center (Optional, adds depth) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/10 blur-[100px] rounded-full"></div>

    </div>
  );
};