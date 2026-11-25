import React from 'react';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  delay?: number;
}

export function GlowCard({ children, className = '', onClick }: GlowCardProps) {
  return (
    <div
      onClick={onClick}
      className={`dune-card ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

