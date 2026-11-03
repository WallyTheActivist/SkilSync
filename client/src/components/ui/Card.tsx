import React from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children, className, hover = false, padding = 'md', onClick,
}) => (
  <div
    onClick={onClick}
    className={clsx(
      'bg-white rounded-xl border border-gray-100 shadow-card',
      hover && 'hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
      padding === 'none' && '',
      padding === 'sm' && 'p-4',
      padding === 'md' && 'p-6',
      padding === 'lg' && 'p-8',
      className,
    )}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={clsx('flex items-center justify-between mb-4', className)}>{children}</div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h3 className={clsx('text-lg font-semibold text-gray-900', className)}>{children}</h3>
);

export default Card;
