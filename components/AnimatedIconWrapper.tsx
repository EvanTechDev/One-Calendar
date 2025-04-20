'use client';

import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'motion/react';
import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const iconVariants: Variants = {
  normal: {
    scale: 1,
    rotate: 0,
  },
  animate: {
    scale: 1.1,
    rotate: [0, -5, 5, 0],
    transition: {
      rotate: {
        duration: 0.5,
        ease: 'easeInOut',
      },
      scale: {
        type: 'spring',
        stiffness: 400,
        damping: 12,
      },
    },
  },
};

interface AnimatedIconWrapperProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const AnimatedIconWrapper = forwardRef<AnimatedIconHandle, AnimatedIconWrapperProps>(
  ({ children, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start('animate');
        }
        onMouseEnter?.(e);
      },
      [controls, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current) {
          controls.start('normal');
        }
        onMouseLeave?.(e);
      },
      [controls, onMouseLeave],
    );

    return (
      <div
        className="hover:bg-accent flex cursor-pointer select-none items-center justify-center rounded-md p-2 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {typeof children === 'function'
          ? children(controls)
          : (children as React.ReactNode)}
      </div>
    );
  },
);

AnimatedIconWrapper.displayName = 'AnimatedIconWrapper';

export { AnimatedIconWrapper, iconVariants };
