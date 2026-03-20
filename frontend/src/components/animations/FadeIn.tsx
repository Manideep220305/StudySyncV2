import React from 'react';
import { motion, type TargetAndTransition } from 'framer-motion';

// TypeScript: Define props for the FadeIn animation wrapper component.
// All props have defaults so you can just use <FadeIn> with no props if needed.
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;                              // Delay in seconds before animation starts
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'; // Which direction to animate in from
  className?: string;
  fullWidth?: boolean;                         // Set to true inside a grid to take 100% width
}

// FadeIn — A reusable scroll-triggered animation wrapper using Framer Motion.
// Wrapping any JSX in <FadeIn> will make it fade into view when scrolled to.
// The `whileInView` prop triggers the animation only when the element is visible in the viewport.
const FadeIn = ({
  children,
  delay = 0,
  direction = 'up',
  className = '',
  fullWidth = false,
}: FadeInProps) => {
  // Map each direction string to the starting position/opacity for the animation
  const directions: Record<NonNullable<FadeInProps['direction']>, TargetAndTransition> = {
    up:    { y: 40, opacity: 0 },
    down:  { y: -40, opacity: 0 },
    left:  { x: 40, opacity: 0 },
    right: { x: -40, opacity: 0 },
    none:  { opacity: 0 },
  };

  return (
    <motion.div
      initial={directions[direction]}
      whileInView={{ y: 0, x: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }} // Triggers animation when 100px into view
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }} // Smooth easeOutQuad curve
      className={className}
      style={{ width: fullWidth ? '100%' : 'auto' }}
    >
      {children}
    </motion.div>
  );
};

export default FadeIn;
