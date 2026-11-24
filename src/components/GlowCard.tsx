import React from 'react';
import { motion } from 'framer-motion';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  delay?: number;
}

export function GlowCard({ children, className = '', onClick, delay = 0 }: GlowCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ type: 'spring', stiffness: 150, damping: 24, delay }}
      onClick={onClick}
      className={`dune-card ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}
