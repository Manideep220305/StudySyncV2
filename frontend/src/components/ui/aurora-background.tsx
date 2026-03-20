"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export const AuroraBackground = ({ className, children, ...props }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for the interactive glow
  const springX = useSpring(mouseX, { stiffness: 100, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 100, damping: 30 });

  // CHANGED: Reduced the intensity of the touch glow (white opacity 0.15 -> 0.10)
  // This makes the interactive part subtler.
  const glow = useTransform(
    [springX, springY],
    ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, rgba(50, 100, 255, 0.15), transparent 50%)`
  );

  function handleMove(e) {
    const { clientX, clientY } = e;
    mouseX.set(clientX);
    mouseY.set(clientY);
  }

  function handleTouch(e) {
    if (e.touches.length > 0) {
      const { clientX, clientY } = e.touches[0];
      mouseX.set(clientX);
      mouseY.set(clientY);
    }
  }

  return (
    <div
      className={cn(
        "relative flex flex-col h-[100vh] w-full bg-[#020617] text-slate-950 transition-bg overflow-hidden",
        className
      )}
      onMouseMove={handleMove}
      onTouchMove={handleTouch}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* The Wave Aurora Layer */}
        <div
          // CHANGED: Opacity 0.4 -> 0.3 (Overall softer look)
          className="absolute inset-0 opacity-30 animate-wave-aurora"
          style={{
            // CHANGED: The Gradient Colors
            // Removed Cyan (#06b6d4) entirely.
            // Switched to a Navy -> Royal Blue -> Navy transition.
            backgroundImage: `linear-gradient(
              to right,
              transparent 0%,
              #172554 20%,   /* Blue-950 (Deep Navy) */
              #1e40af 40%,   /* Blue-800 (Dark Blue) */
              #2563eb 60%,   /* Blue-600 (Royal Blue - The "Lightest" part, but not Cyan) */
              #172554 80%,   /* Blue-950 (Deep Navy) */
              transparent 100%
            )`,
            backgroundSize: "200% 100%",
            filter: "blur(80px)",
          }}
        />
        
        {/* Interactive Brightness Layer */}
        {/* CHANGED: mix-blend-overlay -> mix-blend-plus-lighter for a softer glow interaction */}
        <motion.div
          className="absolute inset-0 mix-blend-plus-lighter opacity-50"
          style={{
            backgroundImage: glow,
          }}
        />
      
      </div>
      
      {/* Content Layer */}
      <div className="relative z-10 w-full h-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
};