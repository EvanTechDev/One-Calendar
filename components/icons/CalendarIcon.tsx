import { Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimatedIconWrapper, iconVariants } from './AnimatedIconWrapper';
import React, { forwardRef } from 'react';

export const CalendarIcon = forwardRef((props, ref) => (
  <AnimatedIconWrapper ref={ref} {...props}>
    <motion.div variants={iconVariants} animate="normal">
      <Calendar className="w-5 h-5" />
    </motion.div>
  </AnimatedIconWrapper>
));

CalendarIcon.displayName = 'CalendarIcon';
